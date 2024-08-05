@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

const kernel: array<f32, 7> = array<f32, 7>(0.03125, 0.0625, 0.125, 0.25, 0.125, 0.0625, 0.03125);

@fragment
fn horizontal_blur(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var result: vec4<f32> = vec4<f32>(0.0);

    for (var i: i32 = -3; i <= 3; i++) {
        let texCoord = vec2<f32>(FragCoord.x + f32(i), FragCoord.y) / vec2<f32>(textureDimensions(inputTexture, 0));
        result += textureSample(inputTexture, textureSampler, texCoord) * kernel[i + 3];
    }

    return result;
}

@fragment
fn vertical_blur(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var result: vec4<f32> = vec4<f32>(0.0);

    for (var i: i32 = -3; i <= 3; i++) {
        let texCoord = vec2<f32>(FragCoord.x, FragCoord.y + f32(i)) / vec2<f32>(textureDimensions(inputTexture, 0));
        result += textureSample(inputTexture, textureSampler, texCoord) * kernel[i + 3];
    }

    return result;
}
