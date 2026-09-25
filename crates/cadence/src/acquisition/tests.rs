use super::*;

#[test]
fn acquisition_bounds_name_the_crossing() {
    for size in [16_777_215, 16_777_216] {
        assert_eq!(decide("src/large.rs", Class::Source, size), Action::Read { bound: 16_777_216 });
    }
    assert_eq!(decide("src/large.rs", Class::Source, 16_777_217),
        Action::Refuse(Crossing { file: "src/large.rs".into(), size: 16_777_217, bound: 16_777_216 }));
    assert_eq!(decide(".planning/state.json", Class::Store, 1_073_741_824),
        Action::Read { bound: 1_073_741_824 });
    assert_eq!(decide(".planning/state.json", Class::Store, 1_073_741_825),
        Action::Refuse(Crossing { file: ".planning/state.json".into(), size: 1_073_741_825, bound: 1_073_741_824 }));
}

#[test]
fn changed_metadata_refuses_acquired_bytes() {
    let before = Observation { device: 1, inode: 2, size: 3, mode: 0o644,
        modified: (4, 0), changed: (5, 0), regular: true };
    assert!(revalidate("src/a.rs", Class::Source, &before, &before, 3).is_ok());
    for after in [
        Observation { inode: 9, ..before.clone() },
        Observation { device: 9, ..before.clone() },
        Observation { size: 4, ..before.clone() },
        Observation { modified: (4, 1), ..before.clone() },
        Observation { changed: (5, 1), ..before.clone() },
        Observation { mode: 0o600, ..before.clone() },
    ] {
        assert!(matches!(revalidate("src/a.rs", Class::Source, &before, &after, 3),
            Err(Error::Changed(file)) if file == "src/a.rs"));
    }
    assert!(matches!(revalidate("src/a.rs", Class::Source, &before, &before, 2),
        Err(Error::Changed(_))));
    let grown = Observation { size: 16_777_217, ..before.clone() };
    assert!(matches!(revalidate("src/a.rs", Class::Source, &before, &grown, 3),
        Err(Error::Crossing(Crossing { file, size: 16_777_217, bound: 16_777_216 })) if file == "src/a.rs"));
    let non_file = Observation { regular: false, ..before.clone() };
    assert!(matches!(revalidate("src/a.rs", Class::Source, &before, &non_file, 3),
        Err(Error::NotRegular(file)) if file == "src/a.rs"));
}
