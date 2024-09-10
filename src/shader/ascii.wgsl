struct Uniforms {
    background: f32,
    fill: f32,
    edges: f32,
};

@group(0) @binding(0) var raymarchTexture: texture_2d<f32>;
@group(0) @binding(1) var sobelTexture: texture_2d<f32>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;
@group(0) @binding(3) var asciiTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

fn colorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn f(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    let downscale = vec2i(FragCoord.xy / 8) * 8;
    let color = textureLoad(raymarchTexture, downscale, 0);

    // let maskPixel = textureLoad(maskTexture, downscale, 0);
    if textureLoad(maskTexture, downscale, 0).x < 0.7 {
        // return vec4f(1.0) - textureLoad(raymarchTexture, vec2i(FragCoord.xy), 0);
        // return textureLoad(raymarchTexture, vec2i(FragCoord.xy), 0);
        return color;
    }


    let sobel = textureLoad(sobelTexture, vec2i(FragCoord.xy), 0);

    var base = uniforms.background * color;
    if sobel.y > 0 { // isEdge
        // let direction = i32(round(sobel.x * 8.0));

        // 0   |
        // 8   /
        // 16  -
        // 24  \
        // let edge = (direction % 4) * 8;

        // let edgePixel = textureLoad(
        //     asciiTexture,
        //     vec2(edge + 80 + i32(FragCoord.x % 8),
        //         i32(FragCoord.y % 8)), 0
        // );

        base += textureLoad(
            asciiTexture,
            vec2((i32(round(sobel.x * 8.0)) % 4) * 8 + 80 + i32(FragCoord.x % 8),
                i32(FragCoord.y % 8)),
            0
        ) * color * uniforms.edges;
    } else {
        // let luminance = 0.2 * color.r + 0.7 * color.g + 0.1 * color.b;
        // let quantized = floor(luminance * 10) / 10;
        // let offset = i32(min(quantized, 0.9) * 80);
        // let asciiPixel = textureLoad(asciiTexture, vec2i(FragCoord.xy % 8) + vec2i(offset, 0), 0);

        // base += asciiPixel * color * uniforms.fill;

        base += textureLoad(asciiTexture,
            vec2i(FragCoord.xy % 8) +
            vec2i(i32(min(floor((0.2 * color.r + 0.7 * color.g + 0.1 * color.b) * 10) / 10, 0.9) * 80), 0), 0
        ) * color * uniforms.fill;
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
