struct Uniforms {
    _threshold: f32,
    background: f32,
    fill: f32,
    edges: f32,
};

@group(0) @binding(0) var frameTexture: texture_2d<f32>;
@group(0) @binding(1) var maskTexture: texture_2d<f32>;
@group(0) @binding(2) var asciiTexture: texture_2d<f32>;
@group(0) @binding(3) var sobelTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

fn colorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn fs(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    let downscale = vec2i(FragCoord.xy / 8) * 8;
    let color = textureLoad(frameTexture, downscale, 0);

    let maskPixel = textureLoad(maskTexture, downscale, 0);
    if maskPixel.g < 0.7 {
        return textureLoad(frameTexture, vec2i(FragCoord.xy), 0);
        // return color;
    }

    let luminance = 0.2 * color.r + 0.7 * color.g + 0.1 * color.b;
    let quantized = floor(luminance * 10) / 10;
    let offset = i32(min(quantized, 0.9) * 80);

    let asciiPixel = textureLoad(asciiTexture, vec2i(FragCoord.xy % 8) + vec2i(offset, 0), 0);
    let sobel = textureLoad(sobelTexture, vec2i(FragCoord.xy), 0);

    var base = uniforms.background * color;
    if sobel.y == 1.0 {
        let direction = i32(round(sobel.x * 8.0));

        // 0   |
        // 8   /
        // 16  -
        // 24  \
        let edge = (direction % 4) * 8;

        let edgePixel = textureLoad(
            asciiTexture,
            vec2(edge + 80 + i32(FragCoord.x % 8),
                i32(FragCoord.y % 8)), 0
        );

        base += edgePixel * color * uniforms.edges + edgePixel * (1 - uniforms.edges);
    } else {
        base += asciiPixel * color * uniforms.fill + asciiPixel * (1 - uniforms.fill);
    }

    return vec4(
        // colorBurn(color.r, base.r),
        // colorBurn(color.g, base.g),
        // colorBurn(color.b, base.b),
        colorBurn(base.r, color.r),
        colorBurn(base.g, color.g),
        colorBurn(base.b, color.b),
        1.0
    );
}
