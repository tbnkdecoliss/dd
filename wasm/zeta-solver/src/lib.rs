use wasm_bindgen::prelude::*;

const ZETA_VALUES: [f32; 17] = [
    0.0,
    2.8,
    1.644_934_1,
    1.202_056_9,
    1.082_323_2,
    1.036_927_8,
    1.017_343,
    1.008_349_3,
    1.004_077_3,
    1.002_008_4,
    1.000_994_6,
    1.000_494_2,
    1.000_246_,
    1.000_122_7,
    1.000_061_3,
    1.000_030_6,
    1.000_015_3,
];

#[wasm_bindgen]
pub fn compute_zeta_signatures(phases: &[f32], bands: &[u8], depth: u32) -> Vec<f32> {
    let len = phases.len().min(bands.len());
    let max_depth = depth.clamp(1, 16) as usize;
    let mut output = vec![0.0; len * 3];

    for index in 0..len {
        let phase = phases[index];
        let band = bands[index] as f32;
        let mut wave = 0.0f32;
        let mut shear = 0.0f32;
        let mut drift = 0.0f32;
        let mut total_weight = 0.0f32;

        for order in 1..=max_depth {
            let raw_value = ZETA_VALUES[order];
            let normalized = if order == 1 { 1.0 } else { raw_value - 1.0 };
            let weight = if order == 1 {
                0.85
            } else {
                1.0 / (order as f32).powf(0.82)
            };
            let order_f = order as f32;
            let order_phase = phase * order_f + band * order_f * 0.18 + index as f32 * 0.003 * order_f;

            wave += order_phase.sin() * normalized * weight;
            shear += (order_phase * 0.7 - band * 0.16 * order_f).cos() * normalized * weight;
            drift += (order_phase * 0.42 + index as f32 * 0.0023).sin() * normalized * weight;
            total_weight += weight;
        }

        let normalization = total_weight.max(0.0001);
        let base = index * 3;
        output[base] = wave / normalization;
        output[base + 1] = shear / normalization;
        output[base + 2] = drift / normalization;
    }

    output
}
