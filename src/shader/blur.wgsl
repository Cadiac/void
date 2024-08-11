@group(0) @binding(0) var inputTexture: texture_2d<f32>;

const kernel: array<array<f32, 5>, 5> = array<array<f32, 5>, 5>(
    array<f32, 5>(0.02, 0.03, 0.04, 0.03, 0.02),
    array<f32, 5>(0.03, 0.05, 0.05, 0.05, 0.03),
    array<f32, 5>(0.04, 0.05, 0.06, 0.05, 0.04),
    array<f32, 5>(0.03, 0.05, 0.05, 0.05, 0.03),
    array<f32, 5>(0.02, 0.03, 0.04, 0.03, 0.02)
);

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var result: vec4<f32> = vec4<f32>(0.0);

    for (var y: i32 = -2; y <= 2; y++) {
        for (var x: i32 = -2; x <= 2; x++) {
            result += textureLoad(inputTexture, vec2i(FragCoord.xy) + vec2i(x, y), 0) * kernel[y + 2][x + 2];
        }
    }

    return result;
}
