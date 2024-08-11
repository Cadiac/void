@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const kernel: array<array<f32, 5>, 5> = array<array<f32, 5>, 5>(
    array<f32, 5>(0.023, 0.034, 0.038, 0.034, 0.023),
    array<f32, 5>(0.034, 0.049, 0.056, 0.049, 0.034),
    array<f32, 5>(0.038, 0.056, 0.063, 0.056, 0.038),
    array<f32, 5>(0.034, 0.049, 0.056, 0.049, 0.034),
    array<f32, 5>(0.023, 0.034, 0.038, 0.034, 0.023)
);

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var result: vec4<f32> = vec4<f32>(0.0);
    let texSize = vec2<f32>(textureDimensions(inputTexture, 0));

    for (var y: i32 = -2; y <= 2; y++) {
        for (var x: i32 = -2; x <= 2; x++) {
            let texCoord = (FragCoord.xy + vec2<f32>(f32(x), f32(y))) / texSize;
            result += textureSample(inputTexture, textureSampler, texCoord) * kernel[y + 2][x + 2];
        }
    }

    return result;
}
