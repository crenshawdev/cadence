//! One boundary for starting an external program.
//!
//! Every spawn goes through `Process`, so a check can hand the code a recorded
//! fake instead of running real git, gpg or `sh`. `System` is the only
//! implementation that starts a child. `Recorded` is the fake: scripted outputs
//! in, the launches it was given out.
//!
//! The environment travels in the `Launch` rather than being fixed here,
//! because the call sites disagree: `rail::git::run` removes
//! `GIT_LITERAL_PATHSPECS` where `pause::git::run` sets it to 1, and
//! `recall::history` adds `GIT_NO_LAZY_FETCH` that no other git call sets.
//! Fixing one environment here would change behavior at those sites.

use std::ffi::{OsStr, OsString};
use std::io::{Read, Write};
use std::os::unix::process::{CommandExt, ExitStatusExt};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

/// What to run, and how to hold it while it runs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Launch {
    git_registration: Option<crate::git_process::Registration>,
    pub program: OsString,
    pub args: Vec<OsString>,
    /// Where the child runs. `None` leaves it in this process's own directory,
    /// which is what a `git -C <dir>` call site relies on.
    pub cwd: Option<PathBuf>,
    /// Bytes written to the child's stdin, which is then closed.
    pub stdin: Option<Vec<u8>>,
    /// Environment for the child. `None` removes the variable.
    pub env: Vec<(String, Option<OsString>)>,
    /// Bytes kept per stream. The rest is read and dropped, and the matching
    /// `complete` flag on the output is false. Unbounded unless a caller that
    /// must not be flooded by a child sets it.
    pub limit: usize,
    /// Kill the child once it has run this long.
    pub timeout: Option<Duration>,
    /// Put the child in its own process group, and kill that group once the
    /// child is reaped, so a descendant cannot hold the pipes open.
    pub own_group: bool,
    /// Kill the child when the process that started it dies.
    pub die_with_parent: bool,
    /// Let the child use this process's own stdin, stdout and stderr. Nothing
    /// is captured, so the output carries no bytes.
    pub inherit: bool,
}

impl Launch {
    pub fn new(program: impl AsRef<OsStr>) -> Self {
        Self {
            git_registration: None,
            program: program.as_ref().to_owned(),
            args: Vec::new(),
            cwd: None,
            stdin: None,
            env: Vec::new(),
            limit: usize::MAX,
            timeout: None,
            own_group: false,
            die_with_parent: false,
            inherit: false,
        }
    }

    pub fn cwd(mut self, cwd: impl AsRef<Path>) -> Self {
        self.cwd = Some(cwd.as_ref().to_owned());
        self
    }

    pub(crate) fn registered_git(registration: crate::git_process::Registration) -> Self {
        let mut launch = Self::new("git");
        launch.git_registration = Some(registration);
        launch
    }

    pub(crate) fn git_caller(&self) -> Option<crate::git_process::Caller> {
        self.git_registration.as_ref().map(|registration| registration.caller())
    }

    pub fn arg(mut self, arg: impl AsRef<OsStr>) -> Self {
        self.args.push(arg.as_ref().to_owned());
        self
    }

    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.args.extend(args.into_iter().map(|arg| arg.as_ref().to_owned()));
        self
    }

    pub fn env(mut self, key: &str, value: impl AsRef<OsStr>) -> Self {
        self.env.push((key.to_owned(), Some(value.as_ref().to_owned())));
        self
    }

    pub fn unset(mut self, key: &str) -> Self {
        self.env.push((key.to_owned(), None));
        self
    }

    pub fn stdin(mut self, bytes: impl Into<Vec<u8>>) -> Self {
        self.stdin = Some(bytes.into());
        self
    }

    pub fn limit(mut self, bytes: usize) -> Self {
        self.limit = bytes;
        self
    }

    pub fn timeout(mut self, after: Duration) -> Self {
        self.timeout = Some(after);
        self
    }

    pub fn own_group(mut self) -> Self {
        self.own_group = true;
        self
    }

    pub fn die_with_parent(mut self) -> Self {
        self.die_with_parent = true;
        self
    }

    pub fn inherit(mut self) -> Self {
        self.inherit = true;
        self
    }

    /// The arguments as they read in a message, for a caller's error text.
    pub fn argument_text(&self) -> String {
        self.args
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(" ")
    }
}

/// An immutable launch that passed the process construction gate.
#[derive(Debug)]
pub struct ValidatedLaunch<'a>(&'a Launch);

impl ValidatedLaunch<'_> {
    pub fn descriptor(&self) -> &Launch { self.0 }
}

/// Validate borrowed launch material before a Command or recorded observation
/// can be obtained. The borrow prevents mutation until the consumer is done.
pub fn validate_launch(launch: &Launch) -> std::io::Result<ValidatedLaunch<'_>> {
    let is_git = Path::new(&launch.program).file_name() == Some(OsStr::new("git"));
    match (is_git, launch.git_caller()) {
        (true, Some(caller)) => {
            if launch.timeout != Some(crate::git_process::deadline(caller).work) || !launch.own_group {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput,
                    "registered git launch requires its caller deadline and owned process group"));
            }
        }
        (true, None) => return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput,
            "git launch requires a registered caller")),
        (false, Some(_)) => return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput,
            "registered git launch cannot change executable identity")),
        (false, None) => {}
    }
    Ok(ValidatedLaunch(launch))
}

/// What a finished child left behind.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Output {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    /// False when the stream was longer than the launch's limit.
    pub stdout_complete: bool,
    pub stderr_complete: bool,
}

impl Output {
    /// An exit with this code and these streams, for a fake's script.
    pub fn exited(code: i32, stdout: impl Into<Vec<u8>>, stderr: impl Into<Vec<u8>>) -> Self {
        Self {
            status: ExitStatus::from_raw(code << 8),
            stdout: stdout.into(),
            stderr: stderr.into(),
            stdout_complete: true,
            stderr_complete: true,
        }
    }

    /// A death by signal, for a fake's script.
    pub fn signaled(signal: i32) -> Self {
        Self {
            status: ExitStatus::from_raw(signal),
            stdout: Vec::new(),
            stderr: Vec::new(),
            stdout_complete: true,
            stderr_complete: true,
        }
    }

    pub fn success(&self) -> bool {
        self.status.success()
    }

    pub fn code(&self) -> Option<i32> {
        self.status.code()
    }

    pub fn signal(&self) -> Option<i32> {
        self.status.signal()
    }

    pub fn complete(&self) -> bool {
        self.stdout_complete && self.stderr_complete
    }
}

/// The one way to start an external program.
pub trait Process {
    fn run(&mut self, launch: &Launch) -> std::io::Result<Output>;

    /// Start a child and hand it back while it runs, for the one caller that
    /// reads a stream as it arrives rather than after the fact. Only `System`
    /// offers this; a fake refuses it unless it scripts children of its own.
    fn start(&mut self, launch: &Launch) -> std::io::Result<Box<dyn Child>> {
        let _ = launch;
        Err(std::io::Error::other("this process does not start children"))
    }
}

/// A child that is still running.
pub trait Child {
    /// Taken once; the caller reads it on its own thread.
    fn stdout(&mut self) -> Option<Box<dyn Read + Send>>;
    fn stderr(&mut self) -> Option<Box<dyn Read + Send>>;
    fn wait(&mut self) -> std::io::Result<ExitStatus>;
    fn kill(&mut self) -> std::io::Result<()>;
}

/// Starts real children.
#[derive(Clone, Copy, Debug, Default)]
pub struct System;

impl System {
    fn command(validated: &ValidatedLaunch<'_>) -> Command {
        let launch = validated.descriptor();
        let mut command = Command::new(&launch.program);
        command.args(&launch.args);
        if let Some(cwd) = &launch.cwd {
            command.current_dir(cwd);
        }
        for (key, value) in &launch.env {
            match value {
                Some(value) => command.env(key, value),
                None => command.env_remove(key),
            };
        }
        if launch.inherit {
            command.stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::inherit());
        } else {
            command
                .stdin(if launch.stdin.is_some() { Stdio::piped() } else { Stdio::null() })
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
        }
        if launch.own_group {
            command.process_group(0);
        }
        if launch.die_with_parent {
            let owner = std::process::id() as libc::pid_t;
            // Safety: the closure runs between fork and exec in the child and
            // calls only async-signal-safe functions.
            unsafe {
                command.pre_exec(move || {
                    if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                    if libc::getppid() != owner {
                        return Err(std::io::Error::other("the owner exited before the spawn"));
                    }
                    Ok(())
                })
            };
        }

        command
    }
}

impl Process for System {
    fn run(&mut self, launch: &Launch) -> std::io::Result<Output> {
        let mut child = SystemChild::spawn(launch)?;
        let out_stream = child.stdout();
        let err_stream = child.stderr();
        let limit = launch.limit;
        std::thread::scope(|scope| {
            let out = out_stream.map(|stream| scope.spawn(move || bounded(stream, limit)));
            let err = err_stream.map(|stream| scope.spawn(move || bounded(stream, limit)));
            let status = child.wait();
            // Always join the drains after cleanup, including on timeout.
            let stdout = out.map(|handle| handle.join().expect("stdout reader")).transpose();
            let stderr = err.map(|handle| handle.join().expect("stderr reader")).transpose();
            let status = status?;
            let (stdout, stdout_complete) = stdout?.unwrap_or((Vec::new(), true));
            let (stderr, stderr_complete) = stderr?.unwrap_or((Vec::new(), true));
            Ok(Output { status, stdout, stderr, stdout_complete, stderr_complete })
        })
    }

    fn start(&mut self, launch: &Launch) -> std::io::Result<Box<dyn Child>> {
        Ok(Box::new(SystemChild::spawn(launch)?))
    }
}

/// Signaling and waiting remain observations gathered by SystemChild.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeadlineAction { Wait, KillAndReap }

pub fn deadline_action(timeout: Option<Duration>, elapsed: Duration) -> DeadlineAction {
    if timeout.is_some_and(|limit| elapsed >= limit) {
        DeadlineAction::KillAndReap
    } else {
        DeadlineAction::Wait
    }
}

/// A real child of this process, including its stdin worker and deadline.
struct SystemChild {
    child: std::process::Child,
    started: Instant,
    timeout: Option<Duration>,
    own_group: bool,
    input: Option<std::thread::JoinHandle<std::io::Result<()>>>,
}

impl SystemChild {
    fn spawn(launch: &Launch) -> std::io::Result<Self> {
        let validated = validate_launch(launch)?;
        let launch = validated.descriptor();
        let mut command = System::command(&validated);
        // Includes spawn and all stdin delivery, not just the wait.
        let started = Instant::now();
        let mut child = command.spawn()?;
        let input = child.stdin.take().zip(launch.stdin.clone()).map(|(mut stdin, bytes)| {
            std::thread::spawn(move || stdin.write_all(&bytes))
        });
        Ok(Self { child, started, timeout: launch.timeout, own_group: launch.own_group, input })
    }

    fn kill_group(&self) {
        if self.own_group {
            // Safety: this group was created for this owned child.
            unsafe { libc::kill(-(self.child.id() as i32), libc::SIGKILL) };
        }
    }

    fn observe_exit(&mut self) -> std::io::Result<ExitStatus> {
        loop {
            if let Some(status) = self.child.try_wait()? {
                return Ok(status);
            }
            if deadline_action(self.timeout, self.started.elapsed()) == DeadlineAction::KillAndReap {
                return Err(std::io::ErrorKind::TimedOut.into());
            }
            if self.timeout.is_none() {
                return self.child.wait();
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}

impl Child for SystemChild {
    fn stdout(&mut self) -> Option<Box<dyn Read + Send>> {
        self.child.stdout.take().map(|stream| Box::new(stream) as Box<dyn Read + Send>)
    }

    fn stderr(&mut self) -> Option<Box<dyn Read + Send>> {
        self.child.stderr.take().map(|stream| Box::new(stream) as Box<dyn Read + Send>)
    }

    fn wait(&mut self) -> std::io::Result<ExitStatus> {
        let status = self.observe_exit();
        // Kill the group before joining any pipe worker. A descendant may
        // retain either end even after the immediate child has exited.
        self.kill_group();
        if status.is_err() {
            let _ = self.child.kill();
            self.child.wait()?;
        }
        let input = self.input.take().map(|handle| handle.join().expect("stdin writer")).transpose();
        // The timeout observation takes precedence over cleanup's broken pipe.
        let status = status?;
        input?;
        Ok(status)
    }

    fn kill(&mut self) -> std::io::Result<()> {
        self.kill_group();
        self.child.kill()
    }
}

/// Read a stream whole, keeping at most `limit` bytes of it.
fn bounded(mut stream: impl Read, limit: usize) -> std::io::Result<(Vec<u8>, bool)> {
    let mut bytes = Vec::new();
    let mut complete = true;
    let mut chunk = [0; 8192];
    loop {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            return Ok((bytes, complete));
        }
        let keep = read.min(limit.saturating_sub(bytes.len()));
        bytes.extend_from_slice(&chunk[..keep]);
        complete &= keep == read;
    }
}

/// The fake: scripted outputs in, the launches it was given out.
#[derive(Debug, Default)]
pub struct Recorded {
    scripted: std::collections::VecDeque<std::io::Result<Output>>,
    launches: Vec<Launch>,
}

impl Recorded {
    pub fn new() -> Self {
        Self::default()
    }

    /// Queue an exit with code 0 and this standard output.
    pub fn out(self, stdout: impl Into<Vec<u8>>) -> Self {
        self.answer(Output::exited(0, stdout, ""))
    }

    /// Queue an exit with this code and this standard error.
    pub fn fail(self, code: i32, stderr: impl Into<Vec<u8>>) -> Self {
        self.answer(Output::exited(code, "", stderr))
    }

    /// Queue an output of the caller's own making.
    pub fn answer(mut self, output: Output) -> Self {
        self.scripted.push_back(Ok(output));
        self
    }

    /// Queue a failure to start the program at all.
    pub fn unavailable(mut self, error: std::io::Error) -> Self {
        self.scripted.push_back(Err(error));
        self
    }

    /// Every launch this fake was given, in order.
    pub fn launches(&self) -> &[Launch] {
        &self.launches
    }

    /// The one launch this fake was given; panics when it was given any other
    /// number, which is the assertion a check usually wants.
    pub fn launch(&self) -> &Launch {
        assert_eq!(self.launches.len(), 1, "expected one launch: {:?}", self.launches);
        &self.launches[0]
    }

    /// The arguments of each launch, which is what most checks read.
    pub fn arguments(&self) -> Vec<Vec<String>> {
        self.launches
            .iter()
            .map(|launch| {
                launch.args.iter().map(|arg| arg.to_string_lossy().into_owned()).collect()
            })
            .collect()
    }
}

impl Process for Recorded {
    fn run(&mut self, launch: &Launch) -> std::io::Result<Output> {
        let validated = validate_launch(launch)?;
        let launch = validated.descriptor();
        self.launches.push(launch.clone());
        self.scripted
            .pop_front()
            .unwrap_or_else(|| panic!("no scripted answer for {:?} {:?}", launch.program, launch.args))
    }
}

#[cfg(test)]
mod tests;
