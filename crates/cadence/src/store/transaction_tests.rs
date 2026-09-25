//! What `commit` and `recover` ask storage to do, in what order, and what they
//! leave behind when one request fails. Storage here is a map of targets with
//! a log of requests and at most one injected failure. Nothing touches a disk,
//! and nothing here shows that a real file survives a crash or reaches it.

use super::model::{DECISIONS, ITEMS, STATE, Snapshot};
use super::transaction::{INTENT, IntentKind, Participant, commit, recover};
use super::{Error, MutationContext, Observed, Policy, Result, Storage};
use crate::process::Recorded;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

const DIR: &str = "store";
const DECISION: &[u8] = b"{\"version\":1,\"id\":\"d\",\"revision\":1,\"origin\":{\"source\":\"t\",\"original\":\"missing\"},\"decision\":{\"class\":\"gate\",\"outcome\":\"d\",\"evidence\":{\"text\":\"recorded\"}}}\n";
const GLOBAL: &str = "global-config";

/// One request made of storage or of the policy, in the order it was made.
#[derive(Clone, Debug, PartialEq, Eq)]
enum Request {
    Prepare(String),
    Install(String),
    Discard(String),
    Confirm(String),
    Resync(String),
    Remove(String),
    Policy(String),
}
use Request::*;

fn at(target: &str) -> String {
    target.into()
}

/// A request that fails once with an I/O error, either before it changes
/// anything or after its change has landed.
#[derive(Clone, Debug)]
enum Fault {
    Before(Request),
    After(Request),
}

type Log = Arc<Mutex<Vec<Request>>>;

struct Disk {
    files: BTreeMap<String, Observed>,
    log: Log,
    fault: Option<Fault>,
    /// Bytes another program writes into a target just before a request runs.
    edit: Option<(Request, String, Vec<u8>)>,
}

fn file(bytes: &[u8]) -> Observed {
    Observed { bytes: Some(bytes.to_vec()), identity: "file".into(), directory_identity: DIR.into() }
}

impl Disk {
    fn requests(&self) -> Vec<Request> {
        self.log.lock().unwrap().clone()
    }

    fn bytes(&self, target: &str) -> Option<Vec<u8>> {
        self.files.get(target).and_then(|observed| observed.bytes.clone())
    }

    /// Record `request`, run the edit waiting on it, and fail it if it is the
    /// injected fault. Answers whether the change is to land, and the error.
    fn step(&mut self, request: Request) -> (bool, Result<()>) {
        if self.edit.as_ref().is_some_and(|(when, _, _)| *when == request) {
            let (_, target, bytes) = self.edit.take().unwrap();
            self.files.insert(target, file(&bytes));
        }
        self.log.lock().unwrap().push(request.clone());
        let error = || Err(Error::Io(format!("injected {request:?}")));
        match self.fault.clone() {
            Some(Fault::Before(failing)) if failing == request => {
                self.fault = None;
                (false, error())
            }
            Some(Fault::After(failing)) if failing == request => {
                self.fault = None;
                (true, error())
            }
            _ => (true, Ok(())),
        }
    }

    fn installed(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        let observed = self.read(target)?;
        if observed.bytes.as_deref() != Some(bytes) {
            return Err(Error::Io(format!("{target} does not hold the installed bytes")));
        }
        Ok(observed)
    }
}

impl Storage for Disk {
    type Prepared = (String, Vec<u8>);

    fn read(&mut self, target: &str) -> Result<Observed> {
        Ok(self.files.get(target).cloned().unwrap_or(Observed {
            bytes: None,
            identity: "missing".into(),
            directory_identity: DIR.into(),
        }))
    }
    fn prepare(&mut self, target: &str, bytes: &[u8]) -> Result<Self::Prepared> {
        let (_, result) = self.step(Prepare(at(target)));
        result.map(|()| (target.into(), bytes.to_vec()))
    }
    fn install(&mut self, prepared: &Self::Prepared) -> Result<()> {
        let (lands, result) = self.step(Install(prepared.0.clone()));
        if lands {
            self.files.insert(prepared.0.clone(), file(&prepared.1));
        }
        result
    }
    fn discard(&mut self, prepared: Self::Prepared) -> Result<()> {
        self.step(Discard(prepared.0)).1
    }
    fn confirm(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        self.step(Confirm(at(target))).1?;
        self.installed(target, bytes)
    }
    fn resync(&mut self, target: &str, bytes: &[u8]) -> Result<Observed> {
        self.step(Resync(at(target))).1?;
        self.installed(target, bytes)
    }
    fn remove(&mut self, target: &str) -> Result<()> {
        let (lands, result) = self.step(Remove(at(target)));
        if lands {
            self.files.remove(target);
        }
        result
    }
}

/// A policy that records each check in the storage log and allows or refuses.
struct Rule {
    log: Log,
    refuse: bool,
}

impl Policy for Rule {
    fn validate(&mut self, context: &MutationContext<'_>) -> Result<()> {
        self.log.lock().unwrap().push(Policy(context.operation.into()));
        if self.refuse {
            return Err(Error::Policy("refused".into()));
        }
        Ok(())
    }
}

fn snapshot(generation: u64, decisions: &[u8]) -> Snapshot {
    Snapshot::new(generation, b"", decisions, json!({"value": generation})).unwrap()
}

fn old_state() -> Vec<u8> {
    snapshot(1, b"").render().unwrap()
}

fn new_state() -> Vec<u8> {
    snapshot(2, DECISION).render().unwrap()
}

/// A store at generation 1 with no items and no decisions, and a global
/// config file registered beside it.
fn disk() -> Disk {
    Disk {
        files: BTreeMap::from([
            (ITEMS.into(), file(b"")),
            (DECISIONS.into(), file(b"")),
            (STATE.into(), file(&old_state())),
            (GLOBAL.into(), file(b"old: config\n")),
        ]),
        log: Log::default(),
        fault: None,
        edit: None,
    }
}

fn change(target: &str, before: &[u8], after: &[u8]) -> Participant {
    Participant { target: target.into(), expected: file(before), bytes: after.to_vec() }
}

/// The write to generation 2: one decision appended, items unchanged.
fn participants() -> Vec<Participant> {
    vec![
        change(ITEMS, b"", b""),
        change(DECISIONS, b"", DECISION),
        change(STATE, &old_state(), &new_state()),
    ]
}

/// The same write, also replacing the registered global config.
fn with_config() -> Vec<Participant> {
    let mut participants = participants();
    participants.insert(0, change(GLOBAL, b"old: config\n", b"new: config\n"));
    participants
}

fn allow(disk: &Disk) -> Rule {
    Rule { log: disk.log.clone(), refuse: false }
}

fn refuse(disk: &Disk) -> Rule {
    Rule { log: disk.log.clone(), refuse: true }
}

fn commit_to(disk: &mut Disk, policy: &mut Rule, participants: Vec<Participant>) -> Result<()> {
    let next = snapshot(2, DECISION);
    let context = MutationContext { operation: "store", snapshot: &next };
    commit(disk, policy, &context, &next, IntentKind::Store, participants, &mut Recorded::new())
}

fn recover_on(disk: &mut Disk, policy: &mut Rule) -> Result<()> {
    recover(disk, policy, &mut Recorded::new())
}

/// The requests that change what a target holds, in order.
fn changes(requests: &[Request]) -> Vec<Request> {
    requests.iter().filter(|request| matches!(request, Install(_) | Remove(_))).cloned().collect()
}

/// Every target as the committed write leaves it.
fn assert_written(disk: &Disk) {
    assert_eq!(disk.bytes(ITEMS), Some(Vec::new()));
    assert_eq!(disk.bytes(DECISIONS), Some(DECISION.to_vec()));
    assert_eq!(disk.bytes(STATE), Some(new_state()));
    assert_eq!(disk.bytes(INTENT), None);
}

/// Every target as it was before the write, with no intent.
fn assert_untouched(disk: &Disk) {
    assert_eq!(disk.bytes(ITEMS), Some(Vec::new()));
    assert_eq!(disk.bytes(DECISIONS), Some(Vec::new()));
    assert_eq!(disk.bytes(STATE), Some(old_state()));
    assert_eq!(disk.bytes(GLOBAL), Some(b"old: config\n".to_vec()));
    assert_eq!(disk.bytes(INTENT), None);
}

#[test]
fn a_commit_writes_the_intent_first_the_state_last_and_removes_the_intent_after_it() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    commit_to(&mut disk, &mut policy, participants()).unwrap();
    assert_eq!(
        changes(&disk.requests()),
        [Install(at(INTENT)), Install(at(DECISIONS)), Install(at(STATE)), Remove(at(INTENT))]
    );
    assert_written(&disk);
}

#[test]
fn a_commit_confirms_the_intent_and_each_participant_before_the_next_change() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    commit_to(&mut disk, &mut policy, participants()).unwrap();
    let requests = disk.requests();
    for target in [INTENT, DECISIONS, STATE] {
        let install = requests.iter().position(|r| *r == Install(at(target))).unwrap();
        let confirm = requests.iter().position(|r| *r == Confirm(at(target))).unwrap();
        let next = requests[install + 1..].iter().position(|r| matches!(r, Install(_) | Remove(_)));
        assert!(
            next.is_none_or(|next| confirm < install + 1 + next),
            "{target} is confirmed before the next change: {requests:?}"
        );
    }
}

/// Failures that happen before the intent is on disk: preparing any file, or
/// installing the intent without it landing.
fn before_the_intent() -> [Fault; 4] {
    [
        Fault::Before(Prepare(at(DECISIONS))),
        Fault::Before(Prepare(at(STATE))),
        Fault::Before(Prepare(at(INTENT))),
        Fault::Before(Install(at(INTENT))),
    ]
}

/// Failures once the intent is on disk, up to removing it.
fn after_the_intent() -> [Fault; 9] {
    [
        Fault::After(Install(at(INTENT))),
        Fault::Before(Confirm(at(INTENT))),
        Fault::Before(Install(at(DECISIONS))),
        Fault::After(Install(at(DECISIONS))),
        Fault::Before(Confirm(at(DECISIONS))),
        Fault::Before(Install(at(STATE))),
        Fault::After(Install(at(STATE))),
        Fault::Before(Confirm(at(STATE))),
        Fault::Before(Remove(at(INTENT))),
    ]
}

fn installs(requests: &[Request]) -> Vec<Request> {
    requests.iter().filter(|request| matches!(request, Install(_))).cloned().collect()
}

#[test]
fn a_failure_before_the_intent_lands_fails_the_commit_and_changes_nothing() {
    for fault in before_the_intent() {
        let mut disk = disk();
        disk.fault = Some(fault.clone());
        let mut policy = allow(&disk);
        let result = commit_to(&mut disk, &mut policy, participants());
        assert!(matches!(result, Err(Error::Io(_))), "{fault:?}: {result:?}");
        assert_untouched(&disk);
    }
}

#[test]
fn a_failure_after_the_intent_lands_fails_the_commit_and_keeps_the_intent() {
    for fault in after_the_intent() {
        let mut disk = disk();
        disk.fault = Some(fault.clone());
        let mut policy = allow(&disk);
        let result = commit_to(&mut disk, &mut policy, participants());
        assert!(matches!(result, Err(Error::Io(_))), "{fault:?}: {result:?}");
        assert!(disk.bytes(INTENT).is_some(), "{fault:?}");
    }
}

#[test]
fn a_participant_changed_outside_the_writer_is_refused_before_anything_is_prepared() {
    let mut disk = disk();
    disk.files.insert(GLOBAL.into(), file(b"edited: elsewhere\n"));
    let mut policy = allow(&disk);
    assert_eq!(
        commit_to(&mut disk, &mut policy, with_config()),
        Err(Error::Conflict("pending participant changed: global-config".into()))
    );
    assert_eq!(disk.requests(), []);
    assert_eq!(disk.bytes(GLOBAL), Some(b"edited: elsewhere\n".to_vec()));
}

#[test]
fn a_target_edited_after_preparation_is_refused_keeping_the_foreign_bytes() {
    for when in [Prepare(at(INTENT)), Confirm(at(INTENT))] {
        let mut disk = disk();
        disk.edit = Some((when.clone(), DECISIONS.into(), b"foreign\n".to_vec()));
        let mut policy = allow(&disk);
        assert_eq!(
            commit_to(&mut disk, &mut policy, participants()),
            Err(Error::Conflict("pending participant changed: decisions.jsonl".into())),
            "{when:?}"
        );
        assert_eq!(disk.bytes(DECISIONS), Some(b"foreign\n".to_vec()), "{when:?}");
        assert_eq!(disk.bytes(STATE), Some(old_state()), "{when:?}");
        let requests = disk.requests();
        assert!(!requests.contains(&Install(at(DECISIONS))), "{when:?}: {requests:?}");
        for target in [DECISIONS, STATE] {
            assert!(requests.contains(&Discard(at(target))), "{when:?}: {target} {requests:?}");
        }
    }
}

#[test]
fn a_policy_refusal_installs_nothing_and_discards_every_prepared_file() {
    let mut disk = disk();
    let mut policy = refuse(&disk);
    assert_eq!(
        commit_to(&mut disk, &mut policy, participants()),
        Err(Error::Policy("refused".into()))
    );
    let requests = disk.requests();
    assert_eq!(installs(&requests), []);
    for target in [DECISIONS, STATE, INTENT] {
        assert!(requests.contains(&Discard(at(target))), "{target}: {requests:?}");
    }
    assert_untouched(&disk);
}

#[test]
fn the_policy_is_checked_after_the_intent_is_prepared_and_before_it_lands() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    commit_to(&mut disk, &mut policy, participants()).unwrap();
    let requests = disk.requests();
    let position = |request: &Request| requests.iter().position(|r| r == request).unwrap();
    let check = position(&Policy("store".into()));
    assert!(position(&Prepare(at(INTENT))) < check, "{requests:?}");
    assert!(check < position(&Install(at(INTENT))), "{requests:?}");
}

#[test]
fn a_pending_intent_refuses_a_new_commit_before_anything_is_prepared() {
    let mut disk = disk();
    disk.files.insert(INTENT.into(), file(b"{}"));
    let mut policy = allow(&disk);
    assert_eq!(
        commit_to(&mut disk, &mut policy, participants()),
        Err(Error::Conflict("pending operation requires recovery".into()))
    );
    assert_eq!(disk.requests(), []);
}

/// A store left by a commit of `participants` that failed at `fault`, after
/// its intent landed, with the log cleared for what comes next.
fn interrupted(fault: Fault, participants: Vec<Participant>) -> Disk {
    let mut disk = disk();
    disk.fault = Some(fault.clone());
    let mut policy = allow(&disk);
    assert!(commit_to(&mut disk, &mut policy, participants).is_err(), "{fault:?}");
    assert!(disk.bytes(INTENT).is_some(), "{fault:?}");
    disk.log.lock().unwrap().clear();
    disk
}

/// Failures inside a recovery that starts with no participant installed.
fn during_recovery() -> [Fault; 9] {
    [
        Fault::Before(Resync(at(ITEMS))),
        Fault::Before(Prepare(at(DECISIONS))),
        Fault::Before(Install(at(DECISIONS))),
        Fault::After(Install(at(DECISIONS))),
        Fault::Before(Confirm(at(DECISIONS))),
        Fault::Before(Install(at(STATE))),
        Fault::After(Install(at(STATE))),
        Fault::Before(Confirm(at(STATE))),
        Fault::Before(Remove(at(INTENT))),
    ]
}

fn nothing_installed() -> Disk {
    interrupted(Fault::Before(Install(at(DECISIONS))), participants())
}

#[test]
fn recovery_after_any_failure_past_the_intent_writes_the_committed_unit() {
    for fault in after_the_intent() {
        let mut disk = interrupted(fault.clone(), participants());
        let mut policy = allow(&disk);
        assert_eq!(recover_on(&mut disk, &mut policy), Ok(()), "{fault:?}");
        assert_written(&disk);
    }
}

#[test]
fn a_second_recovery_after_a_completed_one_requests_no_change() {
    let mut disk = nothing_installed();
    let mut policy = allow(&disk);
    recover_on(&mut disk, &mut policy).unwrap();
    disk.log.lock().unwrap().clear();
    assert_eq!(recover_on(&mut disk, &mut policy), Ok(()));
    assert_eq!(disk.requests(), []);
    assert_written(&disk);
}

#[test]
fn a_failure_during_recovery_fails_it_and_keeps_the_intent_as_it_was() {
    for fault in during_recovery() {
        let mut disk = nothing_installed();
        let intent = disk.bytes(INTENT);
        disk.fault = Some(fault.clone());
        let mut policy = allow(&disk);
        let result = recover_on(&mut disk, &mut policy);
        assert!(matches!(result, Err(Error::Io(_))), "{fault:?}: {result:?}");
        assert_eq!(disk.bytes(INTENT), intent, "{fault:?}");
    }
}

#[test]
fn a_recovery_interrupted_at_any_step_completes_on_the_next_attempt() {
    for fault in during_recovery() {
        let mut disk = nothing_installed();
        disk.fault = Some(fault.clone());
        let mut policy = allow(&disk);
        assert!(recover_on(&mut disk, &mut policy).is_err(), "{fault:?}");
        assert_eq!(recover_on(&mut disk, &mut policy), Ok(()), "{fault:?}");
        assert_written(&disk);
    }
}

#[test]
fn recovery_refuses_a_participant_holding_foreign_bytes_and_writes_nothing() {
    let mut disk = nothing_installed();
    let intent = disk.bytes(INTENT);
    disk.files.insert(DECISIONS.into(), file(b"foreign\n"));
    let mut policy = allow(&disk);
    assert_eq!(
        recover_on(&mut disk, &mut policy),
        Err(Error::Conflict("pending participant changed: decisions.jsonl".into()))
    );
    assert_eq!(changes(&disk.requests()), []);
    assert_eq!(disk.bytes(DECISIONS), Some(b"foreign\n".to_vec()));
    assert_eq!(disk.bytes(INTENT), intent);
}

#[test]
fn recovery_refuses_a_replaced_store_directory_and_writes_nothing() {
    let mut disk = nothing_installed();
    for observed in disk.files.values_mut() {
        observed.directory_identity = "replaced".into();
    }
    let mut policy = allow(&disk);
    let result = recover_on(&mut disk, &mut policy);
    assert!(matches!(result, Err(Error::Conflict(_))), "{result:?}");
    assert_eq!(changes(&disk.requests()), []);
}

#[test]
fn recovery_accepts_an_installed_participant_under_a_new_file_identity() {
    let mut disk = interrupted(Fault::Before(Confirm(at(STATE))), participants());
    disk.files.get_mut(STATE).unwrap().identity = "renamed".into();
    let mut policy = allow(&disk);
    assert_eq!(recover_on(&mut disk, &mut policy), Ok(()));
    assert_written(&disk);
}

#[test]
fn recovery_checks_the_policy_as_recovery_before_installing_any_participant() {
    let mut disk = nothing_installed();
    let mut policy = allow(&disk);
    recover_on(&mut disk, &mut policy).unwrap();
    let requests = disk.requests();
    let check = requests.iter().position(|r| *r == Policy("recovery".into())).unwrap();
    let first = requests.iter().position(|r| matches!(r, Install(_))).unwrap();
    assert!(check < first, "{requests:?}");
}

#[test]
fn a_denying_policy_fails_recovery_writes_nothing_and_keeps_the_intent() {
    let mut disk = nothing_installed();
    let intent = disk.bytes(INTENT);
    let mut policy = refuse(&disk);
    assert_eq!(recover_on(&mut disk, &mut policy), Err(Error::Policy("refused".into())));
    assert_eq!(changes(&disk.requests()), []);
    assert_eq!(disk.bytes(INTENT), intent);
    assert_eq!(disk.bytes(STATE), Some(old_state()));
}

#[test]
fn recovery_installs_a_registered_config_participant_with_the_unit() {
    let mut disk = interrupted(Fault::Before(Install(at(GLOBAL))), with_config());
    assert_eq!(disk.bytes(GLOBAL), Some(b"old: config\n".to_vec()));
    let mut policy = allow(&disk);
    assert_eq!(recover_on(&mut disk, &mut policy), Ok(()));
    assert_eq!(disk.bytes(GLOBAL), Some(b"new: config\n".to_vec()));
    assert_written(&disk);
}

#[test]
fn recovery_keeps_an_outside_participant_that_already_landed_and_only_resyncs_it() {
    let mut disk = interrupted(Fault::Before(Confirm(at(GLOBAL))), with_config());
    assert_eq!(disk.bytes(GLOBAL), Some(b"new: config\n".to_vec()));
    let mut policy = allow(&disk);
    assert_eq!(recover_on(&mut disk, &mut policy), Ok(()));
    let requests = disk.requests();
    assert!(requests.contains(&Resync(at(GLOBAL))), "{requests:?}");
    assert!(!requests.iter().any(|request| matches!(request, Prepare(target) | Install(target) if target == GLOBAL)), "{requests:?}");
    assert_eq!(disk.bytes(GLOBAL), Some(b"new: config\n".to_vec()));
    assert_written(&disk);
}

#[test]
fn a_tampered_intent_is_refused_before_any_write() {
    let mut disk = nothing_installed();
    let mut intent: serde_json::Value = serde_json::from_slice(&disk.bytes(INTENT).unwrap()).unwrap();
    intent["participants"][0]["target"] = json!(ITEMS);
    let tampered = serde_json::to_vec(&intent).unwrap();
    disk.files.insert(INTENT.into(), file(&tampered));
    let mut policy = allow(&disk);
    assert_eq!(
        recover_on(&mut disk, &mut policy),
        Err(Error::Conflict("invalid operation intent integrity".into()))
    );
    assert_eq!(changes(&disk.requests()), []);
    assert_eq!(disk.bytes(INTENT), Some(tampered));
}

/// How many times `count` ticks on this thread while `work` runs.
fn ticks(count: &'static std::thread::LocalKey<std::cell::Cell<usize>>, work: impl FnOnce()) -> usize {
    let before = count.with(std::cell::Cell::get);
    work();
    count.with(std::cell::Cell::get) - before
}

#[test]
fn a_commit_digests_its_intent_once() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    let participants = participants();
    let digests = ticks(&super::transaction::INTENT_DIGESTS, || {
        commit_to(&mut disk, &mut policy, participants).unwrap()
    });
    assert_eq!(digests, 1);
}

#[test]
fn a_commit_parses_the_previous_state_once() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    let participants = participants();
    let parses = ticks(&super::transaction::PREVIOUS_PARSES, || {
        commit_to(&mut disk, &mut policy, participants).unwrap()
    });
    assert_eq!(parses, 1);
}

#[test]
fn a_commit_never_parses_the_state_it_installs() {
    let mut disk = disk();
    let mut policy = allow(&disk);
    let participants = participants();
    let parses = ticks(&super::transaction::NEW_STATE_PARSES, || {
        commit_to(&mut disk, &mut policy, participants).unwrap()
    });
    assert_eq!(parses, 0);
}

mod native_inputs {
    use super::super::transaction::{admission_inputs_hold, dispatch_inputs_hold};
    use super::*;

    fn inventory(bytes: &[u8], identity: &str) -> Observed {
        Observed { bytes: Some(bytes.to_vec()), identity: identity.into(), directory_identity: "phase-12".into() }
    }

    fn state(directory: &str) -> Observed {
        Observed { bytes: Some(b"{}".to_vec()), identity: "state".into(), directory_identity: directory.into() }
    }

    fn rule(result: Result<()>) -> String {
        let Err(Error::Invalid(message)) = result else { panic!("not a located refusal: {result:?}") };
        let diagnostic: crate::plan::model::Diagnostic = serde_json::from_str(message.strip_prefix("plan-refusal:").unwrap()).unwrap();
        diagnostic.rule
    }

    #[test]
    fn an_admission_confirms_against_the_inventory_and_store_it_was_prepared_in() {
        let prepared = inventory(b"PLAN-1.md", "inode-1");
        assert_eq!(admission_inputs_hold(12, &prepared, "store", &prepared.clone(), &state("store")), Ok(()));
    }

    #[test]
    fn an_admission_whose_plan_inventory_changed_before_confirmation_is_refused() {
        let prepared = inventory(b"PLAN-1.md", "inode-1");
        for changed in [inventory(b"PLAN-1.md\nPLAN-2.md", "inode-1"), inventory(b"PLAN-1.md", "inode-2")] {
            assert_eq!(rule(admission_inputs_hold(12, &prepared, "store", &changed, &state("store"))), "admission-inputs-changed");
        }
    }

    #[test]
    fn an_admission_whose_store_is_no_longer_the_bound_one_is_refused() {
        let prepared = inventory(b"PLAN-1.md", "inode-1");
        assert_eq!(rule(admission_inputs_hold(12, &prepared, "store", &prepared.clone(), &state("another-store"))), "admission-inputs-changed");
    }

    #[test]
    fn a_dispatch_confirms_only_against_the_inventory_it_was_prepared_from() {
        let prepared = inventory(b"PLAN-1.md", "inode-1");
        assert_eq!(dispatch_inputs_hold(12, &prepared, &prepared.clone()), Ok(()));
        assert_eq!(rule(dispatch_inputs_hold(12, &prepared, &inventory(b"PLAN-1.md\nPLAN-2.md", "inode-1"))), "admission-inputs-changed");
    }
}
