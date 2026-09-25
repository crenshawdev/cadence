//! Reading Git's branch listing, choosing the branch work is measured against,
//! and the questions pause asks about the branch it is on.
//!
//! `observe` runs the commands; everything here takes what it read. Every check
//! is bytes or values in, values out, so none of them starts Git or fakes it.
use super::branch::{
    Integration, Observed, Policy, base, choose_base, integration, integration_name,
    parse_branches, protected, read_merge_base,
};
use crate::evidence::gates::Gate;
use crate::store::Error;
use std::collections::BTreeMap;

const MAIN: &str = "1111111111111111111111111111111111111111";
const WORK: &str = "2222222222222222222222222222222222222222";

fn policy(base: Option<&str>, protected: &[&str]) -> Policy {
    Policy {
        protected: protected.iter().map(|name| (*name).to_owned()).collect(),
        on_protected: "refuse".into(),
        base: base.map(str::to_owned),
        integration: "main".into(),
        auto_branch: "ask".into(),
    }
}

fn branches(names: &[(&str, &str)]) -> BTreeMap<String, String> {
    names.iter().map(|(name, sha)| ((*name).to_owned(), (*sha).to_owned())).collect()
}

#[test]
fn each_ref_reads_as_a_branch_name_without_its_prefix() {
    assert_eq!(
        parse_branches(&format!("refs/heads/main {MAIN}\nrefs/heads/cadence/work {WORK}\n")).unwrap(),
        branches(&[("main", MAIN), ("cadence/work", WORK)])
    );
}

#[test]
fn no_refs_is_no_branches() {
    assert!(parse_branches("").unwrap().is_empty());
}

// A ref outside refs/heads keeps its full name rather than being mistaken for
// a branch of the same short name.
#[test]
fn a_ref_outside_refs_heads_keeps_its_whole_name() {
    assert_eq!(
        parse_branches(&format!("refs/remotes/origin/main {MAIN}\n")).unwrap(),
        branches(&[("refs/remotes/origin/main", MAIN)])
    );
}

#[test]
fn a_line_without_a_commit_is_refused() {
    assert!(parse_branches("refs/heads/main\n").is_err());
}

// The owner named the base, so a policy that names one either gets it or gets
// nothing. Falling back would measure the work against a branch they did not
// choose.
#[test]
fn a_named_base_is_used_when_it_exists_and_nothing_is_used_when_it_does_not() {
    let branches = branches(&[("main", MAIN), ("develop", WORK)]);
    assert_eq!(choose_base(&policy(Some("develop"), &["main"]), &branches), Some("develop".to_owned()));
    assert_eq!(choose_base(&policy(Some("release"), &["main"]), &branches), None);
}

#[test]
fn with_no_named_base_the_first_protected_branch_that_exists_is_used() {
    let branches = branches(&[("main", MAIN)]);
    assert_eq!(choose_base(&policy(None, &["trunk", "main", "master"]), &branches), Some("main".to_owned()));
}

// Protected order is the owner's preference order, not the repository's.
#[test]
fn the_protected_order_decides_which_of_several_is_chosen() {
    let branches = branches(&[("main", MAIN), ("master", WORK)]);
    assert_eq!(choose_base(&policy(None, &["master", "main"]), &branches), Some("master".to_owned()));
    assert_eq!(choose_base(&policy(None, &["main", "master"]), &branches), Some("main".to_owned()));
}

#[test]
fn no_protected_branch_exists_and_none_is_named_leaves_no_base() {
    assert_eq!(choose_base(&policy(None, &["main"]), &branches(&[("cadence/work", WORK)])), None);
    assert_eq!(choose_base(&policy(None, &[]), &branches(&[("main", MAIN)])), None);
}

fn observed(branch: &str, base: Option<&str>, shared_history: bool) -> Observed {
    Observed {
        branch: branch.into(),
        head: WORK.into(),
        branches: branches(&[("main", MAIN)]),
        tags: Vec::new(),
        base: base.map(str::to_owned),
        shared_history,
        project: String::new(),
        roadmap: String::new(),
    }
}

fn asking(on_protected: &str) -> Policy {
    Policy { on_protected: on_protected.into(), ..policy(None, &["main"]) }
}

fn options(gate: &Gate) -> Vec<&str> {
    gate.options.iter().map(|option| option.id.as_str()).collect()
}

#[test]
fn a_protected_branch_under_ask_gets_one_create_proceed_or_abort_question() {
    let gate = protected(&asking("ask"), &observed("main", Some("main"), true)).unwrap().unwrap();
    assert!(gate.id.starts_with("pause-protected-"), "{}", gate.id);
    assert_eq!(options(&gate), ["create", "proceed", "abort"]);
}

#[test]
fn the_protected_question_is_the_same_question_each_time_it_is_asked() {
    let ask = || protected(&asking("ask"), &observed("main", Some("main"), true)).unwrap();
    assert_eq!(ask(), ask());
}

#[test]
fn refuse_on_a_protected_branch_is_a_policy_refusal() {
    let refused = protected(&asking("refuse"), &observed("main", Some("main"), true));
    assert!(matches!(refused, Err(Error::Policy(_))), "{refused:?}");
}

#[test]
fn an_unprotected_branch_or_allow_asks_nothing() {
    assert_eq!(protected(&asking("ask"), &observed("work", Some("main"), true)).unwrap(), None);
    assert_eq!(protected(&asking("allow"), &observed("main", Some("main"), true)).unwrap(), None);
}

fn asked(policy: &Policy, observed: &Observed) -> Vec<String> {
    base(policy, observed).unwrap().into_iter().map(|gate| gate.id).collect()
}

#[test]
fn a_detached_head_asks_the_detached_question() {
    let ids = asked(&policy(None, &["main"]), &observed("", Some("main"), true));
    assert_eq!(ids.len(), 1);
    assert!(ids[0].starts_with("pause-detached-"), "{ids:?}");
}

#[test]
fn a_configured_base_that_does_not_resolve_asks_missing_base() {
    let ids = asked(&policy(Some("release"), &["main"]), &observed("work", None, false));
    assert_eq!(ids.len(), 1);
    assert!(ids[0].starts_with("pause-missing-base-"), "{ids:?}");
}

#[test]
fn no_base_at_all_asks_unknown_base() {
    let ids = asked(&policy(None, &["main"]), &observed("work", None, false));
    assert_eq!(ids.len(), 1);
    assert!(ids[0].starts_with("pause-unknown-base-"), "{ids:?}");
}

#[test]
fn a_base_sharing_no_history_asks_unrelated_base() {
    let ids = asked(&policy(None, &["main"]), &observed("work", Some("main"), false));
    assert_eq!(ids.len(), 1);
    assert!(ids[0].starts_with("pause-unrelated-base-"), "{ids:?}");
}

// A base that moved on since the work branched still shares history with it.
#[test]
fn a_base_sharing_history_asks_nothing() {
    assert!(asked(&policy(None, &["main"]), &observed("work", Some("main"), true)).is_empty());
}

#[test]
fn merge_base_naming_a_commit_is_shared_history() {
    assert_eq!(read_merge_base(Some(0), format!("{MAIN}\n").as_bytes(), b""), Ok(true));
}

#[test]
fn merge_base_with_nothing_in_common_is_no_shared_history() {
    assert_eq!(read_merge_base(Some(1), b"", b""), Ok(false));
    assert_eq!(read_merge_base(Some(0), b"", b""), Ok(false));
}

#[test]
fn any_other_merge_base_exit_is_a_failure() {
    for code in [Some(128), None] {
        let failure = read_merge_base(code, b"", b"fatal: bad object").unwrap_err().to_string();
        assert!(failure.contains("merge-base failed: fatal: bad object"), "{failure}");
    }
}

#[test]
fn the_active_version_in_project_wins_over_the_roadmap_title() {
    assert_eq!(
        integration_name("# Project\n\n### Active\n\nv1.4.0 adds pause.\n", "# Roadmap v1.3.0\n"),
        Some("cadence/v1.4.0".into())
    );
}

#[test]
fn without_an_active_version_the_roadmap_title_names_the_branch() {
    assert_eq!(integration_name("# Project\n", "# Roadmap v1.3.0\n"), Some("cadence/v1.3.0".into()));
    assert_eq!(integration_name("# Project\n", "# Roadmap\n"), None);
}

fn milestone(auto_branch: &str) -> Policy {
    Policy { integration: "milestone".into(), auto_branch: auto_branch.into(), ..policy(None, &["main"]) }
}

fn versioned(branch: &str, tags: &[&str]) -> Observed {
    Observed {
        roadmap: "# Roadmap v1.3.0\n".into(),
        tags: tags.iter().map(|tag| (*tag).to_owned()).collect(),
        ..observed(branch, Some("main"), true)
    }
}

#[test]
fn integration_stays_on_trunk_off_a_protected_branch_or_with_auto_branch_off() {
    let trunk = Policy { integration: "trunk".into(), ..milestone("auto") };
    assert_eq!(integration(&trunk, &versioned("main", &[])).unwrap(), Integration::Stay);
    assert_eq!(integration(&milestone("auto"), &versioned("work", &[])).unwrap(), Integration::Stay);
    assert_eq!(integration(&milestone("off"), &versioned("main", &[])).unwrap(), Integration::Stay);
}

#[test]
fn auto_creates_the_named_integration_branch() {
    assert_eq!(
        integration(&milestone("auto"), &versioned("main", &[])).unwrap(),
        Integration::Create("cadence/v1.3.0".into())
    );
}

#[test]
fn ask_asks_to_create_the_named_integration_branch() {
    let Integration::Ask(gate, name) = integration(&milestone("ask"), &versioned("main", &[])).unwrap() else {
        panic!("an integration question")
    };
    assert!(gate.id.starts_with("pause-integration-"), "{}", gate.id);
    assert_eq!(name.as_deref(), Some("cadence/v1.3.0"));
}

#[test]
fn no_milestone_version_asks_missing_version() {
    let observed = observed("main", Some("main"), true);
    let Integration::Ask(gate, name) = integration(&milestone("auto"), &observed).unwrap() else {
        panic!("a missing-version question")
    };
    assert!(gate.id.starts_with("pause-missing-version-"), "{}", gate.id);
    assert_eq!(name, None);
}

#[test]
fn a_version_already_tagged_asks_published_version() {
    for tag in ["v1.3.0", "1.3.0", "v1.3.0+build.7"] {
        let Integration::Ask(gate, name) = integration(&milestone("auto"), &versioned("main", &[tag])).unwrap()
        else {
            panic!("a published-version question for {tag}")
        };
        assert!(gate.id.starts_with("pause-published-version-"), "{tag}: {}", gate.id);
        assert_eq!(name, None);
    }
}
