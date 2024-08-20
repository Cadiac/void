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

fn blendColorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn fs(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    let downscale = vec2(i32(FragCoord.x / 8) * 8, i32(FragCoord.y / 8) * 8);
    let color = textureLoad(frameTexture, downscale, 0);

    let maskPixel = textureLoad(maskTexture, downscale, 0);
    if maskPixel.g < 0.7 {
        return textureLoad(frameTexture, vec2i(FragCoord.xy), 0);
        // return color;
    }

    // let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    let luminance = 0.2 * color.r + 0.7 * color.g + 0.1 * color.b;
    let quantized = floor(luminance * 10) / 10;
    let offset = min(quantized, 0.9) * 80.0;

    let asciiPixel = textureLoad(asciiTexture, vec2i(i32(offset + FragCoord.x % 8), i32(FragCoord.y % 8)), 0);
    let sobel = textureLoad(sobelTexture, vec2i(FragCoord.xy), 0);

    let isEdge = sobel.y == 1.0;
    if !isEdge {
        let output = uniforms.background * color + asciiPixel * color * uniforms.fill + asciiPixel * (1 - uniforms.fill);
        return vec4(
            blendColorBurn(color.r, output.r),
            blendColorBurn(color.g, output.g),
            blendColorBurn(color.b, output.b),
            1.0
        );
    }

    let direction = u32(round(sobel.x * 8.0));

    var edge = 32; // \
    if direction % 4 == 0 {
        edge = 8; // |
    }
    if direction % 4 == 1 {
        edge = 24; // /
    }
    if direction % 4 == 2 {
        edge = 16; // -
    }

    let edgePixel = textureLoad(
        asciiTexture,
        vec2(edge + 80 + i32(FragCoord.x % 8),
            i32(FragCoord.y % 8)), 0
    );

    let output = uniforms.background * color + edgePixel * color * uniforms.edges + edgePixel * (1 - uniforms.edges);

    return vec4(
        blendColorBurn(color.r, output.r),
        blendColorBurn(color.g, output.g),
        blendColorBurn(color.b, output.b),
        1.0
    );
}
