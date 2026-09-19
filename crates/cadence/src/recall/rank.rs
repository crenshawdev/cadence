//! Pure BM25 with the frozen raw-stopword / suffix-fold ordering.
use std::collections::{BTreeMap, BTreeSet};

const STOP: &str = "a an the and or of to in is it for on with as by at be are was were that this from but not no so if than will can";

fn consonant(w: &[u8], i: usize) -> bool {
    match w[i] {
        b'a' | b'e' | b'i' | b'o' | b'u' => false,
        b'y' => i == 0 || !consonant(w, i - 1),
        _ => true,
    }
}

fn fold(term: &str) -> String {
    if term.len() <= 2 {
        return term.into();
    }
    let mut w = term.to_string();
    if w.ends_with("sses") || w.ends_with("ies") {
        w.truncate(w.len() - 2);
    } else if w.ends_with('s') && !w.ends_with("ss") {
        w.pop();
    }
    if w.ends_with("eed") {
        let stem = &w.as_bytes()[..w.len() - 3];
        if (1..stem.len()).any(|i| !consonant(stem, i - 1) && consonant(stem, i)) {
            w.pop();
        }
        return w;
    }
    let cut = if w.ends_with("ed") {
        2
    } else if w.ends_with("ing") {
        3
    } else {
        0
    };
    if cut == 0 || !(0..w.len() - cut).any(|i| !consonant(w.as_bytes(), i)) {
        return w;
    }
    w.truncate(w.len() - cut);
    let b = w.as_bytes();
    let n = b.len();
    if ["at", "bl", "iz"].iter().any(|s| w.ends_with(s)) {
        w.push('e');
    } else if n >= 2 && b[n - 1] == b[n - 2] && consonant(b, n - 1) && !b"lsz".contains(&b[n - 1]) {
        w.pop();
    } else if n >= 3
        && consonant(b, n - 3)
        && !consonant(b, n - 2)
        && consonant(b, n - 1)
        && !b"wxy".contains(&b[n - 1])
    {
        w.push('e');
    }
    w
}

pub fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty() && !STOP.split_whitespace().any(|stop| stop == *s))
        .map(fold)
        .collect()
}

pub struct Index {
    frequencies: Vec<BTreeMap<String, usize>>,
    lengths: Vec<usize>,
    df: BTreeMap<String, usize>,
    average: f64,
}

impl Index {
    pub fn new<'a>(texts: impl Iterator<Item = &'a str>) -> Self {
        let mut frequencies = Vec::new();
        let mut lengths = Vec::new();
        let mut df = BTreeMap::new();
        for text in texts {
            let terms = tokenize(text);
            lengths.push(terms.len());
            let mut tf = BTreeMap::new();
            for term in terms {
                *tf.entry(term).or_insert(0) += 1;
            }
            for term in tf.keys() {
                *df.entry(term.clone()).or_insert(0) += 1;
            }
            frequencies.push(tf);
        }
        let average = lengths.iter().sum::<usize>() as f64 / lengths.len().max(1) as f64;
        Self {
            frequencies,
            lengths,
            df,
            average,
        }
    }

    pub fn search(&self, query: &str) -> Vec<(usize, f64)> {
        let terms: BTreeSet<_> = tokenize(query).into_iter().collect();
        let count = self.frequencies.len() as f64;
        let mut results = Vec::new();
        for (i, tf) in self.frequencies.iter().enumerate() {
            let mut score = 0.0;
            for term in &terms {
                let frequency = *tf.get(term).unwrap_or(&0) as f64;
                if frequency == 0.0 {
                    continue;
                }
                let df = self.df[term] as f64;
                let idf = (1.0 + (count - df + 0.5) / (df + 0.5)).ln();
                score += idf * frequency * 2.2
                    / (frequency
                        + 1.2 * (0.25 + 0.75 * self.lengths[i] as f64 / self.average.max(1.0)));
            }
            if score > 0.0 {
                results.push((i, score));
            }
        }
        results.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
        results
    }
}
