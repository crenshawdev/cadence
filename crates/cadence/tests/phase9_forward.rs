#[path = "../src/review/forward.rs"]
mod forward;

#[test]
fn forward_exact_return() {
    let input: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/phase9/h4-shapes.json")).unwrap();
    assert_eq!(
        forward::forward_return(input["empty"].as_str().unwrap().as_bytes()).submitted_bytes,
        b"{\"findings\":[]}".to_vec()
    );
}
