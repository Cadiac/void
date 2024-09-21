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

    // "x" carries the direction, "y" tells if this tile is an edge tile.
    let sobel = textureLoad(sobelTexture, vec2i(FragCoord.xy), 0);

    var base = beat * color;

    // Idea based on Acerola's ASCII filter from video "I Tried Turning Games Into Text",
    // https://www.youtube.com/watch?v=gg40RWiaHRY
    // I highly recommend you to watch this, as it gives a pretty good idea on how this whole ASCII effect works,
    // and the idea for the edge detection is based on the same approach as on that video.
    // The sobel shader implements the edge and direction detection, and here we read the direction from that texture.
    if sobel.y > 0 { // isEdge
        // let direction = i32(round(sobel.x * 8.0));

        // Direction from the compute shader maps to these edges:
        // 0:  "|"
        // 8:  "/"
        // 16: "-"
        // 24: "\"

        // let edge = (direction % 4) * 8;

        // let edgePixel = textureLoad(
        //     asciiTexture,
        //     vec2(edge + 80 + i32(FragCoord.x % 8),
        //         i32(FragCoord.y % 8)), 0
        // );

        // Inlined:
        base += textureLoad(
            asciiTexture,
            vec2((i32(round(sobel.x * 8.0)) % 4) * 8 + 80 + i32(FragCoord.x % 8),
                i32(FragCoord.y % 8)),
            0
        ) * color * vec4(1.0, 0.6, 0.0, 1.0); // edges
    } else {
        // For non-edge tiles convert the downscaled tile to greyscale, quantize its luminance to integer 0 - 9
        // and use that to look up matching ASCII character from the texture.

        // let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
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
