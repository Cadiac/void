struct Uniforms {
    _threshold: f32,
    burn: u32,
    amplify: f32,
    color: vec3<f32>,
};

@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var bloomTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn blendColorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let original = textureLoad(originalTexture, vec2i(FragCoord.xy), 0);
    let bloom = textureLoad(bloomTexture, vec2i(FragCoord.xy), 0);

    if uniforms.burn != 0 {
        return vec4(
            blendColorBurn(original.r, bloom.r * uniforms.color.r + uniforms.amplify),
            blendColorBurn(original.g, bloom.g * uniforms.color.g + uniforms.amplify),
            blendColorBurn(original.b, bloom.b * uniforms.color.b + uniforms.amplify),
            1.0
        );
    } else {
        return original + bloom * vec4<f32>(uniforms.color, 1.0);
    }
}
