@group(0) @binding(0) var raymarchTexture: texture_2d<f32>;
@group(0) @binding(1) var sobelTexture: texture_2d<f32>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;
@group(0) @binding(3) var asciiTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> beat: f32;

fn colorBurn(base: f32, blend: f32) -> f32 {
    if blend == 0.0 {
        return blend;
    }

    return max((1.0 - ((1.0 - base) / blend)), 0.0);
}

@fragment
fn f(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    let downscale = vec2i(FragCoord.xy / 8) * 8;
    var color = textureLoad(raymarchTexture, downscale, 0);

    if textureLoad(maskTexture, downscale, 0).x < 1 {
        color *= 2.0;
    }

    let sobel = textureLoad(sobelTexture, vec2i(FragCoord.xy), 0);

    var base = beat * color;

    // isEdge
    if sobel.y > 0 {
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
        ) * color * vec4(1.0, 0.6, 0.0, 1.0); // edges
    } else {
        // let luminance = 0.2 * color.r + 0.7 * color.g + 0.1 * color.b;
        // let quantized = floor(luminance * 10) / 10;
        // let offset = i32(min(quantized, 0.9) * 80);
        // let asciiPixel = textureLoad(asciiTexture, vec2i(FragCoord.xy % 8) + vec2i(offset, 0), 0);

        // base += asciiPixel * color * uniforms.fill;

        base += textureLoad(asciiTexture,
            vec2i(FragCoord.xy % 8) +
            vec2i(i32(min(floor((0.2 * color.x + 0.7 * color.y + 0.1 * color.z) * 10) / 10, 0.9) * 80), 0), 0
        ) * color * 0.5; // Fill
    }

    return vec4(
        colorBurn(base.x, color.x),
        colorBurn(base.y, color.y),
        colorBurn(base.z, color.z),
        1.0
    );
}
