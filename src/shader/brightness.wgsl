struct Uniforms {
    threshold: f32,
    _burn: u32,
    _amplify: f32,
    _color: vec3<f32>,
};

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let texel = textureLoad(inputTexture, vec2i(FragCoord.xy), 0);
    let luminance = 0.2126 * texel.r + 0.7152 * texel.g + 0.0722 * texel.b;

    if luminance > uniforms.threshold {
        return texel;
    }

    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
