@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var bloomTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

fn blendColorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let original = textureSample(originalTexture, textureSampler, FragCoord.xy / vec2<f32>(textureDimensions(originalTexture, 0)));
    let bloom = textureSample(bloomTexture, textureSampler, FragCoord.xy / vec2<f32>(textureDimensions(bloomTexture, 0)));

    // return original + bloom * vec4<f32>(0.8, 0.8, 0.8, 1.0);

    return vec4(
        blendColorBurn(original.r, bloom.r + 0.5),
        blendColorBurn(original.g, bloom.g + 0.5),
        blendColorBurn(original.b, bloom.b + 0.5),
        1.0
    );
}
