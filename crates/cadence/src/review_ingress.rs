//! Bounded JSON-line ingestion before transport deserialization.
use rmcp::{
    RoleServer,
    service::{RxJsonRpcMessage, TxJsonRpcMessage},
    transport::Transport,
};
use std::{
    collections::BTreeSet,
    io,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

const RAW_LIMIT: usize = 4_194_304;
const METADATA_LIMIT: usize = 65_536;
const CHUNK: usize = 1024;
const DEPTH: usize = 128;

#[derive(Clone, Copy)]
struct Limits {
    raw: usize,
    metadata: usize,
    frame: usize,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            raw: RAW_LIMIT,
            metadata: METADATA_LIMIT,
            frame: 6 * RAW_LIMIT + METADATA_LIMIT,
        }
    }
}
fn invalid(code: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, code)
}

#[derive(Default)]
enum Escape {
    #[default]
    Plain,
    Slash,
    Hex {
        value: u16,
        digits: u8,
        high: Option<u16>,
    },
    LowSlash(u16),
    LowU(u16),
}
#[derive(Default)]
struct StringDecoder {
    escape: Escape,
    utf8: [u8; 4],
    used: usize,
    needed: usize,
}
enum Decoded {
    Pending,
    Bytes([u8; 4], usize),
    End,
}
impl StringDecoder {
    fn closes(&self, byte: u8) -> bool {
        byte == b'"' && self.used == 0 && matches!(self.escape, Escape::Plain)
    }
    fn scalar(value: u32) -> io::Result<Decoded> {
        let scalar = char::from_u32(value).ok_or_else(|| invalid("invalid-unicode-scalar"))?;
        let mut bytes = [0; 4];
        let size = scalar.encode_utf8(&mut bytes).len();
        Ok(Decoded::Bytes(bytes, size))
    }
    fn push(&mut self, byte: u8) -> io::Result<Decoded> {
        if self.used != 0 {
            if !(0x80..=0xbf).contains(&byte) {
                return Err(invalid("invalid-utf8"));
            }
            self.utf8[self.used] = byte;
            self.used += 1;
            if self.used != self.needed {
                return Ok(Decoded::Pending);
            }
            std::str::from_utf8(&self.utf8[..self.used]).map_err(|_| invalid("invalid-utf8"))?;
            let size = self.used;
            self.used = 0;
            return Ok(Decoded::Bytes(self.utf8, size));
        }
        match std::mem::take(&mut self.escape) {
            Escape::Plain => match byte {
                b'"' => Ok(Decoded::End),
                b'\\' => {
                    self.escape = Escape::Slash;
                    Ok(Decoded::Pending)
                }
                0..=31 => Err(invalid("unescaped-string-control")),
                32..=127 => Ok(Decoded::Bytes([byte, 0, 0, 0], 1)),
                _ => {
                    self.needed = match byte {
                        0xc2..=0xdf => 2,
                        0xe0..=0xef => 3,
                        0xf0..=0xf4 => 4,
                        _ => return Err(invalid("invalid-utf8")),
                    };
                    self.utf8[0] = byte;
                    self.used = 1;
                    Ok(Decoded::Pending)
                }
            },
            Escape::Slash => match byte {
                b'"' | b'\\' | b'/' => Ok(Decoded::Bytes([byte, 0, 0, 0], 1)),
                b'b' => Self::scalar(8),
                b'f' => Self::scalar(12),
                b'n' => Self::scalar(10),
                b'r' => Self::scalar(13),
                b't' => Self::scalar(9),
                b'u' => {
                    self.escape = Escape::Hex {
                        value: 0,
                        digits: 0,
                        high: None,
                    };
                    Ok(Decoded::Pending)
                }
                _ => Err(invalid("invalid-string-escape")),
            },
            Escape::Hex {
                mut value,
                mut digits,
                high,
            } => {
                let digit = (byte as char)
                    .to_digit(16)
                    .ok_or_else(|| invalid("invalid-unicode-escape"))?;
                value = (value << 4) | digit as u16;
                digits += 1;
                if digits < 4 {
                    self.escape = Escape::Hex {
                        value,
                        digits,
                        high,
                    };
                    return Ok(Decoded::Pending);
                }
                if let Some(high) = high {
                    if !(0xdc00..=0xdfff).contains(&value) {
                        return Err(invalid("invalid-unicode-scalar"));
                    }
                    Self::scalar(
                        0x10000 + ((u32::from(high) - 0xd800) << 10) + (u32::from(value) - 0xdc00),
                    )
                } else if (0xd800..=0xdbff).contains(&value) {
                    self.escape = Escape::LowSlash(value);
                    Ok(Decoded::Pending)
                } else {
                    Self::scalar(u32::from(value))
                }
            }
            Escape::LowSlash(high) if byte == b'\\' => {
                self.escape = Escape::LowU(high);
                Ok(Decoded::Pending)
            }
            Escape::LowU(high) if byte == b'u' => {
                self.escape = Escape::Hex {
                    value: 0,
                    digits: 0,
                    high: Some(high),
                };
                Ok(Decoded::Pending)
            }
            _ => Err(invalid("invalid-unicode-scalar")),
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Location {
    Root,
    Params,
    Arguments,
    Other,
}
#[derive(Clone, Copy, PartialEq)]
enum Position {
    FirstKey,
    Key,
    Colon,
    Value,
    FirstElement,
    Element,
    Comma,
}
struct Container {
    object: bool,
    location: Location,
    position: Position,
    key: String,
    keys: BTreeSet<String>,
}
#[derive(Clone, Copy)]
enum Purpose {
    Key,
    Raw,
    Method,
    Tool,
    Operation,
    Ignore,
}
enum Token {
    String {
        decoder: StringDecoder,
        purpose: Purpose,
        text: Vec<u8>,
    },
    Atom(Vec<u8>),
}
struct Decoder {
    stack: Vec<Container>,
    token: Option<Token>,
    started: bool,
    complete: bool,
    method: Option<String>,
    tool: Option<String>,
    operation: Option<String>,
    raw_bytes: usize,
    metadata_bytes: usize,
    limits: Limits,
}
impl Decoder {
    fn new(limits: Limits) -> Self {
        Self {
            stack: vec![],
            token: None,
            started: false,
            complete: false,
            method: None,
            tool: None,
            operation: None,
            raw_bytes: 0,
            metadata_bytes: 0,
            limits,
        }
    }
    fn review(&self) -> Option<bool> {
        let fields = [
            (&self.method, "tools/call"),
            (&self.tool, "cadence_apply"),
            (&self.operation, "review-return"),
        ];
        if fields
            .iter()
            .any(|(value, wanted)| value.as_ref().is_some_and(|v| v != wanted))
        {
            return Some(false);
        }
        fields
            .iter()
            .all(|(value, _)| value.is_some())
            .then_some(true)
    }
    fn value_done(&mut self) -> io::Result<()> {
        if let Some(parent) = self.stack.last_mut() {
            if !matches!(
                parent.position,
                Position::Value | Position::FirstElement | Position::Element
            ) {
                return Err(invalid("malformed-envelope"));
            }
            parent.position = Position::Comma;
        } else {
            self.complete = true;
        }
        Ok(())
    }
    fn value_location(&self) -> Location {
        match self.stack.last() {
            None => Location::Root,
            Some(parent) if parent.object => match (parent.location, parent.key.as_str()) {
                (Location::Root, "params") => Location::Params,
                (Location::Params, "arguments") => Location::Arguments,
                _ => Location::Other,
            },
            _ => Location::Other,
        }
    }
    fn purpose(&self) -> Purpose {
        match self.stack.last().filter(|c| c.object) {
            Some(parent) => match (parent.location, parent.key.as_str()) {
                (Location::Root, "method") => Purpose::Method,
                (Location::Params, "name") => Purpose::Tool,
                (Location::Arguments, "operation") => Purpose::Operation,
                (Location::Arguments, "raw") => Purpose::Raw,
                _ => Purpose::Ignore,
            },
            _ => Purpose::Ignore,
        }
    }
    fn start_value(&mut self, byte: u8) -> io::Result<()> {
        match byte {
            b'{' | b'[' => {
                if self.stack.len() >= DEPTH {
                    return Err(invalid("envelope-too-deep"));
                }
                self.stack.push(Container {
                    object: byte == b'{',
                    location: if byte == b'{' {
                        self.value_location()
                    } else {
                        Location::Other
                    },
                    position: if byte == b'{' {
                        Position::FirstKey
                    } else {
                        Position::FirstElement
                    },
                    key: String::new(),
                    keys: BTreeSet::new(),
                });
            }
            b'"' => {
                self.token = Some(Token::String {
                    decoder: StringDecoder::default(),
                    purpose: self.purpose(),
                    text: vec![],
                });
            }
            b'-' | b'0'..=b'9' | b't' | b'f' | b'n' => {
                self.token = Some(Token::Atom(vec![byte]));
            }
            _ => return Err(invalid("malformed-envelope")),
        }
        Ok(())
    }
    fn push(&mut self, byte: u8) -> io::Result<()> {
        let raw_wire = matches!(&self.token,Some(Token::String {decoder,purpose:Purpose::Raw,..}) if !decoder.closes(byte));
        if !raw_wire {
            self.metadata_bytes += 1;
            if self.metadata_bytes > self.limits.metadata {
                return Err(invalid("envelope-metadata-too-large"));
            }
        }
        self.consume(byte)?;
        if self.review() == Some(true) && self.raw_bytes > self.limits.raw {
            return Err(invalid("return-too-large"));
        }
        Ok(())
    }
    fn consume(&mut self, byte: u8) -> io::Result<()> {
        if let Some(token) = self.token.take() {
            match token {
                Token::String {
                    mut decoder,
                    purpose,
                    mut text,
                } => {
                    match decoder.push(byte)? {
                        Decoded::Bytes(bytes, size) => {
                            if matches!(purpose, Purpose::Raw) {
                                self.raw_bytes = self
                                    .raw_bytes
                                    .saturating_add(size)
                                    .min(self.limits.raw.saturating_add(1));
                            } else if !matches!(purpose, Purpose::Ignore) {
                                text.extend_from_slice(&bytes[..size]);
                            }
                        }
                        Decoded::End => {
                            let text =
                                String::from_utf8(text).map_err(|_| invalid("invalid-utf8"))?;
                            match purpose {
                                Purpose::Key => {
                                    let parent = self
                                        .stack
                                        .last_mut()
                                        .ok_or_else(|| invalid("malformed-envelope"))?;
                                    if !parent.keys.insert(text.clone()) {
                                        return Err(invalid("duplicate-envelope-key"));
                                    }
                                    parent.key = text;
                                    parent.position = Position::Colon;
                                    return Ok(());
                                }
                                Purpose::Method => self.method = Some(text),
                                Purpose::Tool => self.tool = Some(text),
                                Purpose::Operation => self.operation = Some(text),
                                _ => {}
                            }
                            return self.value_done();
                        }
                        Decoded::Pending => {}
                    }
                    self.token = Some(Token::String {
                        decoder,
                        purpose,
                        text,
                    });
                    return Ok(());
                }
                Token::Atom(mut text) => {
                    if !matches!(byte, b' ' | b'\t' | b'\r' | b'\n' | b',' | b']' | b'}') {
                        text.push(byte);
                        self.token = Some(Token::Atom(text));
                        return Ok(());
                    }
                    let value: serde_json::Value =
                        serde_json::from_slice(&text).map_err(|_| invalid("malformed-envelope"))?;
                    if !matches!(
                        value,
                        serde_json::Value::Null
                            | serde_json::Value::Bool(_)
                            | serde_json::Value::Number(_)
                    ) {
                        return Err(invalid("malformed-envelope"));
                    }
                    self.value_done()?;
                }
            }
        }
        if matches!(byte, b' ' | b'\t' | b'\r' | b'\n') {
            return Ok(());
        }
        if self.complete {
            return Err(invalid("trailing-envelope-data"));
        }
        let Some(parent) = self.stack.last() else {
            if self.started || byte != b'{' {
                return Err(invalid("malformed-envelope"));
            }
            self.started = true;
            return self.start_value(byte);
        };
        let object = parent.object;
        match parent.position {
            Position::FirstKey | Position::Key => {
                if byte == b'}' && parent.position == Position::FirstKey {
                    self.stack.pop();
                    self.value_done()?;
                } else if byte == b'"' {
                    self.token = Some(Token::String {
                        decoder: StringDecoder::default(),
                        purpose: Purpose::Key,
                        text: vec![],
                    });
                } else {
                    return Err(invalid("malformed-envelope"));
                }
            }
            Position::Colon => {
                if byte != b':' {
                    return Err(invalid("malformed-envelope"));
                }
                self.stack.last_mut().unwrap().position = Position::Value;
            }
            Position::Value | Position::Element => self.start_value(byte)?,
            Position::FirstElement if byte == b']' => {
                self.stack.pop();
                self.value_done()?;
            }
            Position::FirstElement => self.start_value(byte)?,
            Position::Comma => {
                if byte == b',' {
                    self.stack.last_mut().unwrap().position = if object {
                        Position::Key
                    } else {
                        Position::Element
                    };
                } else if (object && byte == b'}') || (!object && byte == b']') {
                    self.stack.pop();
                    self.value_done()?;
                } else {
                    return Err(invalid("malformed-envelope"));
                }
            }
        }
        Ok(())
    }
}

struct BoundedInput<R> {
    source: R,
    decoder: Decoder,
    frame: Vec<u8>,
    closed: bool,
    buffer: [u8; CHUNK],
    used: usize,
    at: usize,
}
impl<R: AsyncRead + Unpin> BoundedInput<R> {
    fn new(source: R, limits: Limits) -> Self {
        Self {
            source,
            decoder: Decoder::new(limits),
            frame: vec![],
            closed: false,
            buffer: [0; CHUNK],
            used: 0,
            at: 0,
        }
    }
    async fn next_frame(&mut self) -> io::Result<Option<Vec<u8>>> {
        if self.closed {
            return Ok(None);
        }
        let result = self.read_frame().await;
        if result.is_err() || matches!(result, Ok(None)) {
            self.closed = true;
        }
        result
    }
    async fn read_frame(&mut self) -> io::Result<Option<Vec<u8>>> {
        loop {
            let limits = self.decoder.limits;
            if self.at == self.used {
                let raw = matches!(
                    self.decoder.token,
                    Some(Token::String {
                        purpose: Purpose::Raw,
                        ..
                    })
                );
                let mut budget = if raw { CHUNK } else { 1 };
                budget = budget.min(
                    limits
                        .frame
                        .saturating_sub(self.frame.len())
                        .saturating_add(1),
                );
                budget = budget.min(
                    limits
                        .metadata
                        .saturating_sub(self.decoder.metadata_bytes)
                        .saturating_add(1),
                );
                if self.decoder.review() != Some(false) {
                    budget = budget.min(
                        limits
                            .raw
                            .saturating_sub(self.decoder.raw_bytes)
                            .saturating_add(1),
                    );
                }
                self.used = self.source.read(&mut self.buffer[..budget.max(1)]).await?;
                self.at = 0;
                if self.used == 0 {
                    return Ok(None);
                }
            }
            let byte = self.buffer[self.at];
            self.at += 1;
            if self.frame.len() == limits.frame {
                return Err(invalid("envelope-too-large"));
            }
            if self.frame.len() == self.frame.capacity() {
                let capacity = self
                    .frame
                    .capacity()
                    .saturating_mul(2)
                    .max(CHUNK)
                    .min(limits.frame);
                self.frame.reserve_exact(capacity - self.frame.len());
            }
            self.frame.push(byte);
            self.decoder.push(byte)?;
            if byte == b'\n' {
                if !self.decoder.started {
                    self.frame.clear();
                    self.decoder = Decoder::new(limits);
                    continue;
                }
                if !self.decoder.complete || self.decoder.token.is_some() {
                    return Err(invalid("incomplete-envelope"));
                }
                let frame = std::mem::take(&mut self.frame);
                self.decoder = Decoder::new(limits);
                return Ok(Some(frame));
            }
        }
    }
}

pub struct InputTransport<R, W> {
    read: BoundedInput<R>,
    write: Arc<tokio::sync::Mutex<W>>,
    failed: Arc<AtomicBool>,
}
impl<R: AsyncRead + Unpin, W> InputTransport<R, W> {
    pub fn new(read: R, write: W) -> (Self, Arc<AtomicBool>) {
        let failed = Arc::new(AtomicBool::new(false));
        (
            Self {
                read: BoundedInput::new(read, Limits::default()),
                write: Arc::new(tokio::sync::Mutex::new(write)),
                failed: failed.clone(),
            },
            failed,
        )
    }
}
impl<R, W> Transport<RoleServer> for InputTransport<R, W>
where
    R: AsyncRead + Unpin + Send + 'static,
    W: AsyncWrite + Unpin + Send + 'static,
{
    type Error = io::Error;
    fn send(
        &mut self,
        item: TxJsonRpcMessage<RoleServer>,
    ) -> impl std::future::Future<Output = io::Result<()>> + Send + 'static {
        let write = self.write.clone();
        let bytes = serde_json::to_vec(&item).map_err(io::Error::other);
        async move {
            let mut bytes = bytes?;
            bytes.push(b'\n');
            write.lock().await.write_all(&bytes).await
        }
    }
    async fn receive(&mut self) -> Option<RxJsonRpcMessage<RoleServer>> {
        let received = match self.read.next_frame().await {
            Ok(Some(frame)) => serde_json::from_slice(&frame)
                .map(Some)
                .map_err(io::Error::other),
            Ok(None) => Ok(None),
            Err(error) => Err(error),
        };
        match received {
            Ok(message) => message,
            Err(error) => {
                self.read.closed = true;
                self.failed.store(true, Ordering::Release);
                eprintln!("cadence: input refused: {error}");
                None
            }
        }
    }
    async fn close(&mut self) -> io::Result<()> {
        self.write.lock().await.shutdown().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::{
        future::Future,
        pin::Pin,
        task::{Context, Poll, Waker},
    };
    use tokio::io::ReadBuf;

    const PREFIX: &[u8] = br#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"cadence_apply","arguments":{"operation":"review-return","raw":""#;
    const SUFFIX: &[u8] = b"\"}}}\n";
    struct Chunked {
        bytes: Vec<u8>,
        position: usize,
        chunk: usize,
        max_request: usize,
        pause: Option<usize>,
    }
    impl Chunked {
        fn new(bytes: Vec<u8>) -> Self {
            Self {
                bytes,
                position: 0,
                chunk: CHUNK,
                max_request: 0,
                pause: None,
            }
        }
    }
    impl AsyncRead for Chunked {
        fn poll_read(
            mut self: Pin<&mut Self>,
            _: &mut Context<'_>,
            out: &mut ReadBuf<'_>,
        ) -> Poll<io::Result<()>> {
            self.max_request = self.max_request.max(out.remaining());
            if self.pause == Some(self.position) {
                self.pause = None;
                return Poll::Pending;
            }
            let count = out
                .remaining()
                .min(self.chunk)
                .min(self.bytes.len() - self.position)
                .min(self.pause.map_or(usize::MAX, |at| at - self.position));
            out.put_slice(&self.bytes[self.position..self.position + count]);
            self.position += count;
            Poll::Ready(Ok(()))
        }
    }
    fn padded(size: usize, escaped: bool) -> (Vec<u8>, Vec<u8>) {
        let mut expected = b"{\"findings\":[]}".to_vec();
        expected.resize(size, b' ');
        let mut wire = PREFIX.to_vec();
        wire.extend_from_slice(br#"{\"findings\":[]}"#);
        for _ in b"{\"findings\":[]}".len()..size {
            wire.extend_from_slice(if escaped { b"\\u0020" } else { b" " });
        }
        wire.extend_from_slice(SUFFIX);
        (wire, expected)
    }
    #[tokio::test]
    async fn gap157_exact_cap_accepts_literal_and_escaped_padding() {
        for escaped in [false, true] {
            let (wire, expected) = padded(RAW_LIMIT, escaped);
            let mut input = BoundedInput::new(Chunked::new(wire.clone()), Limits::default());
            let frame = input.next_frame().await.unwrap().unwrap();
            assert_eq!(frame, wire);
            assert!(frame.capacity() <= Limits::default().frame);
            let value: Value = serde_json::from_slice(&frame).unwrap();
            assert_eq!(
                value["params"]["arguments"]["raw"]
                    .as_str()
                    .unwrap()
                    .as_bytes(),
                expected
            );
            assert!(input.source.max_request <= CHUNK);
            assert_eq!(input.buffer.len(), CHUNK);
        }
    }
    #[tokio::test]
    async fn gap157_excess_refuses_before_complete_frame() {
        for escaped in [false, true] {
            let (wire, _) = padded(RAW_LIMIT + 1, escaped);
            let length = wire.len();
            let mut input = BoundedInput::new(Chunked::new(wire), Limits::default());
            assert_eq!(
                input.next_frame().await.unwrap_err().to_string(),
                "return-too-large"
            );
            assert_eq!(input.decoder.raw_bytes, RAW_LIMIT + 1);
            assert!(input.frame.capacity() <= Limits::default().frame);
            assert!(input.source.position < length);
            assert!(input.source.max_request <= CHUNK);
            let stopped = input.source.position;
            assert!(input.next_frame().await.unwrap().is_none());
            assert_eq!(input.source.position, stopped);
        }
    }
    #[test]
    fn gap157_split_outer_string_escapes_preserve_raw_document() {
        // Literal transport spellings are independent of the decoder.
        let wire = br#" {\"claim\":\"quote: \\\"\\n\u96ea\",\"literal\":\"\\u0020\"} "#;
        let expected = r#" {"claim":"quote: \"\n雪","literal":"\u0020"} "#.as_bytes();
        for chunk in [1, 2, 3, 7] {
            let mut decoder = StringDecoder::default();
            let mut output = Vec::new();
            for part in wire.chunks(chunk) {
                for byte in part {
                    match decoder.push(*byte).unwrap() {
                        Decoded::Bytes(bytes, n) => output.extend_from_slice(&bytes[..n]),
                        Decoded::Pending => {}
                        Decoded::End => panic!("early string end"),
                    }
                }
            }
            assert!(matches!(decoder.push(b'"').unwrap(), Decoded::End));
            assert_eq!(output, expected);
        }
        for wire in ["雪😀".as_bytes(), br#"\u96ea\uD83D\uDE00"#] {
            let mut decoder = StringDecoder::default();
            let mut output = Vec::new();
            for byte in wire {
                if let Decoded::Bytes(bytes, n) = decoder.push(*byte).unwrap() {
                    output.extend_from_slice(&bytes[..n]);
                }
            }
            assert_eq!(output, "雪😀".as_bytes());
        }
    }
    fn decode(wire: &[u8]) -> io::Result<Decoder> {
        let mut decoder = Decoder::new(Limits::default());
        for byte in wire {
            decoder.push(*byte)?;
        }
        if !decoder.complete || decoder.token.is_some() {
            return Err(invalid("incomplete-envelope"));
        }
        Ok(decoder)
    }
    #[test]
    fn gap157_reordered_escaped_keys_identify_actual_raw_path() {
        let wire=br#"{"params":{"arguments":{"r\u0061w":"{\"findings\":[]}","oper\u0061tion":"review-return"},"n\u0061me":"cadence_apply"},"method":"tools/call","jsonrpc":"2.0","id":1}"#;
        let decoder = decode(wire).unwrap();
        assert_eq!(decoder.review(), Some(true));
        assert_eq!(decoder.raw_bytes, 15);
    }
    #[test]
    fn gap157_duplicate_identity_operation_raw_and_malformed_envelopes_refuse() {
        for wire in [
            br#"{"params":{"arguments":{"raw":"a","r\u0061w":"b"}}}"#.as_slice(),
            br#"{"params":{"arguments":{"operation":"review-return","operation":"other"}}}"#,
            br#"{"params":{"arguments":{"identity":{},"identity":{}}}}"#,
            br#"{"params":{"arguments":{"identity":{"attempt":"a1","attempt":"a2"}}}}"#,
        ] {
            assert_eq!(
                decode(wire).err().unwrap().to_string(),
                "duplicate-envelope-key"
            );
        }
        for wire in [
            br#"{"a":"\x"}"#.as_slice(),
            br#"{"a":"\uD800"}"#,
            br#"{"a":true,}"#,
            br#"{"a":[1,]}"#,
            br#"{"a":01}"#,
            br#"{}{}"#,
        ] {
            assert!(decode(wire).is_err());
        }
    }
    #[tokio::test]
    async fn gap157_metadata_excess_stops_before_frame_end() {
        let mut wire=br#"{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cadence_apply","arguments":{"operation":"review-return","note":""#.to_vec();
        wire.extend(std::iter::repeat_n(b'x', METADATA_LIMIT + 1));
        wire.extend_from_slice(SUFFIX);
        let length = wire.len();
        let mut input = BoundedInput::new(Chunked::new(wire), Limits::default());
        assert_eq!(
            input.next_frame().await.unwrap_err().to_string(),
            "envelope-metadata-too-large"
        );
        assert_eq!(input.decoder.metadata_bytes, METADATA_LIMIT + 1);
        assert!(input.source.position < length);
    }
    #[tokio::test]
    async fn gap157_overall_frame_limit_bounds_unrelated_input() {
        let limits = Limits {
            raw: 1000,
            metadata: 1000,
            frame: 32,
        };
        let mut wire = br#"{"note":""#.to_vec();
        wire.extend(std::iter::repeat_n(b'x', 100));
        wire.extend_from_slice(b"\"}\n");
        let mut input = BoundedInput::new(Chunked::new(wire), limits);
        assert_eq!(
            input.next_frame().await.unwrap_err().to_string(),
            "envelope-too-large"
        );
        assert_eq!(input.frame.len(), 32);
        assert_eq!(input.source.position, 33);
    }
    #[tokio::test]
    async fn gap157_unrelated_operation_has_no_raw_return_cap() {
        let wire=b"{\"method\":\"tools/call\",\"params\":{\"name\":\"cadence_apply\",\"arguments\":{\"operation\":\"other\",\"raw\":\"1234567890\"}}}\n";
        let mut input = BoundedInput::new(
            Chunked::new(wire.to_vec()),
            Limits {
                raw: 4,
                metadata: 1000,
                frame: 2000,
            },
        );
        assert_eq!(input.next_frame().await.unwrap().unwrap(), wire);
    }
    #[tokio::test]
    async fn gap157_cancelled_poll_keeps_partial_budget() {
        let mut wire = PREFIX.to_vec();
        wire.extend_from_slice(b"1234567890123456");
        wire.extend_from_slice(SUFFIX);
        let mut source = Chunked::new(wire);
        source.pause = Some(PREFIX.len() + 6);
        let mut input = BoundedInput::new(
            source,
            Limits {
                raw: 8,
                metadata: 1000,
                frame: 2000,
            },
        );
        let mut future = Box::pin(input.next_frame());
        let mut context = Context::from_waker(Waker::noop());
        assert!(future.as_mut().poll(&mut context).is_pending());
        drop(future);
        assert_eq!(input.decoder.raw_bytes, 6);
        assert_eq!(
            input.next_frame().await.unwrap_err().to_string(),
            "return-too-large"
        );
        assert_eq!(input.decoder.raw_bytes, 9);
        assert_eq!(input.source.position, PREFIX.len() + 9);
    }
    #[tokio::test]
    async fn gap157_crlf_eof_and_buffered_next_frame_preserve_framing() {
        let wire = b"{\"method\":\"ping\",\"id\":1,\"jsonrpc\":\"2.0\"}\r\n";
        let mut input = BoundedInput::new(Chunked::new(wire.to_vec()), Limits::default());
        assert_eq!(input.next_frame().await.unwrap().unwrap(), wire);
        assert!(input.next_frame().await.unwrap().is_none());
        let mut partial = BoundedInput::new(
            Chunked::new(b"{\"method\":\"ping\"".to_vec()),
            Limits::default(),
        );
        assert!(partial.next_frame().await.unwrap().is_none());
        let mut frames = PREFIX.to_vec();
        frames.extend_from_slice(b"abc");
        frames.extend_from_slice(SUFFIX);
        frames.extend_from_slice(wire);
        let mut input = BoundedInput::new(Chunked::new(frames), Limits::default());
        assert!(input.next_frame().await.unwrap().is_some());
        assert_eq!(input.next_frame().await.unwrap().unwrap(), wire);
    }
}
