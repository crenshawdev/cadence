//! The typed answer vocabulary: `ok`, `refused`, `unknown`, `not-applicable`.
//!
//! Every operation answers with one of these four and nothing else. The point
//! is that a caller can branch on the tag alone without reading prose, so the
//! spellings are load-bearing: `not-applicable` carries a hyphen because that
//! is how the design document spells it and how every later skill will match
//! on it.
//!
//! `refused` is a SUCCESSFUL tool call carrying a refusal, never an MCP error
//! result (D-07). A refusal that arrives with `isError` set is indistinguishable
//! from a crashed tool, and the informed-retry loop would have nothing left to
//! branch on: it would see a failure where the binary was in fact telling it
//! precisely why the thing it asked for is not allowed.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// One operation's answer.
///
/// Serialized internally tagged under `status`, so an `ok` payload's fields sit
/// beside the tag at the top level rather than nested under a key:
///
/// ```json
/// {"status": "ok", "version": "3.7.12", "os": "linux"}
/// {"status": "refused", "code": "no-phase-dir", "reason": "the phase has no CONTEXT.md"}
/// ```
///
/// That is the shape the model already reads from the JavaScript seams, whose
/// envelopes are `{ok, ...fields}`, and matching it means the rewrite does not
/// also retrain what an answer looks like.
///
/// The consequence of an internal tag is that `T` MUST serialize as a JSON
/// object - a struct or a map - because there is nowhere to put a bare scalar
/// beside the tag. An operation with one value to report gives it a named
/// field; there is no arm here for a payload without one.
///
/// The three non-`ok` arms carry a machine `code` and a prose `reason`.
/// Goldens compare the code to the JavaScript refusal token (D-04), so two
/// different refusals cannot agree just because they share an arm tag.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum Envelope<T> {
    /// The operation ran and this is what it produced.
    Ok(T),
    /// The operation could have run and Cadence declined to run it. The caller
    /// asked a well-formed question and the answer is no.
    Refused {
        /// Machine token in the operation's kebab-case vocabulary.
        code: String,
        /// Why, in words a person reads.
        reason: String,
    },
    /// Cadence cannot say. The question is a fair one for this operation and
    /// the evidence to answer it is missing, unreadable or ambiguous.
    Unknown {
        /// Machine token in the operation's kebab-case vocabulary.
        code: String,
        /// What could not be established, in words a person reads.
        reason: String,
    },
    /// The question does not apply here, so there is nothing to be right or
    /// wrong about - a phase gate asked of a repository with no phases.
    #[serde(rename = "not-applicable")]
    NotApplicable {
        /// Machine token in the operation's kebab-case vocabulary.
        code: String,
        /// Why the question does not apply, in words a person reads.
        reason: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use rmcp::handler::server::tool::IntoCallToolResult;
    use rmcp::handler::server::wrapper::Json;
    use rmcp::model::CallToolResponse;
    use serde_json::json;

    /// A stand-in for a real operation's payload. Struct-shaped on purpose:
    /// see the `Envelope` doc comment on why a payload has named fields.
    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
    struct Payload {
        phase: u32,
    }

    #[test]
    fn ok_puts_the_payload_fields_beside_the_tag() {
        let value = serde_json::to_value(Envelope::Ok(Payload { phase: 1 })).unwrap();
        assert_eq!(value, json!({"status": "ok", "phase": 1}));
    }

    #[test]
    fn refused_carries_a_code_and_prose_reason() {
        let envelope: Envelope<Payload> = Envelope::Refused {
            code: "no-phase-dir".to_string(),
            reason: "the phase has no CONTEXT.md".to_string(),
        };
        assert_eq!(
            serde_json::to_value(envelope).unwrap(),
            json!({"status": "refused", "code": "no-phase-dir", "reason": "the phase has no CONTEXT.md"})
        );
    }

    #[test]
    fn unknown_carries_a_code_and_prose_reason() {
        let envelope: Envelope<Payload> = Envelope::Unknown {
            code: "unreadable-tree".to_string(),
            reason: "the working tree could not be read".to_string(),
        };
        assert_eq!(
            serde_json::to_value(envelope).unwrap(),
            json!({"status": "unknown", "code": "unreadable-tree", "reason": "the working tree could not be read"})
        );
    }

    /// The hyphen is the whole test. `not_applicable` and `notApplicable` are
    /// both plausible renderings of the Rust variant and neither is the one
    /// the design document spells or a later skill will match on.
    #[test]
    fn not_applicable_keeps_its_hyphen() {
        let envelope: Envelope<Payload> = Envelope::NotApplicable {
            code: "no-phases".to_string(),
            reason: "this repository has no phases".to_string(),
        };
        let value = serde_json::to_value(envelope).unwrap();
        assert_eq!(value["status"], json!("not-applicable"));
        assert_eq!(
            value,
            json!({"status": "not-applicable", "code": "no-phases", "reason": "this repository has no phases"})
        );
    }

    #[test]
    fn every_arm_round_trips_through_serde_json() {
        let arms: Vec<Envelope<Payload>> = vec![
            Envelope::Ok(Payload { phase: 4 }),
            Envelope::Refused {
                code: "no-phase-dir".to_string(),
                reason: "no".to_string(),
            },
            Envelope::Unknown {
                code: "unreadable-tree".to_string(),
                reason: "cannot say".to_string(),
            },
            Envelope::NotApplicable {
                code: "no-phases".to_string(),
                reason: "does not apply".to_string(),
            },
        ];
        for arm in arms {
            let text = serde_json::to_string(&arm).unwrap();
            let back: Envelope<Payload> = serde_json::from_str(&text).unwrap();
            assert_eq!(back, arm, "round trip changed the envelope: {text}");
        }
    }

    /// D-07, proven through the path a tool actually takes: `Json<T>` is what
    /// an rmcp tool returns to get structured output, and this is the
    /// conversion rmcp runs on it. A refusal has to come out the other side as
    /// a successful call whose structured content carries the tag, because a
    /// caller that cannot tell "I declined" from "I crashed" cannot retry
    /// informed.
    #[test]
    fn refused_is_a_successful_call_carrying_its_refusal() {
        let envelope: Envelope<Payload> = Envelope::Refused {
            code: "no-phase-dir".to_string(),
            reason: "risk floor raises this plan above the configured rung".to_string(),
        };
        let response = Json(envelope)
            .into_call_tool_result()
            .expect("a refusal must not fail to serialize");
        let CallToolResponse::Complete(result) = response else {
            panic!("a refusal must complete, not ask for input or materialize a task");
        };
        let structured = result
            .structured_content
            .expect("the refusal must ride structured content, not a text convention");
        assert_eq!(structured["status"], json!("refused"));
        assert_eq!(structured["code"], json!("no-phase-dir"));
        assert_eq!(
            structured["reason"],
            json!("risk floor raises this plan above the configured rung")
        );
        assert_ne!(
            result.is_error,
            Some(true),
            "a refusal marked isError is indistinguishable from a crash"
        );
    }
}
