@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let texCoord: vec2<f32> = FragCoord.xy / vec2<f32>(textureDimensions(inputTexture, 0));

    let texel = textureSample(inputTexture, textureSampler, texCoord);
    let luminance = 0.2126 * texel.r + 0.7152 * texel.g + 0.0722 * texel.b;

    if (luminance > 0.1) {
        return texel;
    }

    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
