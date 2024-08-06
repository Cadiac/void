struct Uniforms {
    threshold: f32,
    _burn: u32,
    _amplify: f32,
    _color: vec3<f32>,
};

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let texCoord: vec2<f32> = FragCoord.xy / vec2<f32>(textureDimensions(inputTexture, 0));

    let texel = textureSample(inputTexture, textureSampler, texCoord);
    let luminance = 0.2126 * texel.r + 0.7152 * texel.g + 0.0722 * texel.b;

    if luminance > uniforms.threshold {
        return texel;
    }

    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
