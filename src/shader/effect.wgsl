@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let pos = array(
        // First triangle
        vec2f(-1.0, -1.0), // bottom left
        vec2f(1.0, -1.0),  // bottom right
        vec2f(-1.0, 1.0),  // top left

        // Second triangle
        vec2f(-1.0, 1.0),  // bottom right
        vec2f(1.0, -1.0),  // top right
        vec2f(1.0, 1.0),   // top left
    );

    let xy = pos[vertexIndex];

    return vec4f(xy, 0.0, 1.0);
}


@group(0) @binding(0) var frameTexture: texture_2d<f32>;
@group(0) @binding(1) var asciiTexture: texture_2d<f32>;

// Sobel filter kernels
const sobel_x: array<vec3<f32>, 3> = array<vec3<f32>, 3>(
    vec3<f32>(-1.0, 0.0, 1.0),
    vec3<f32>(-2.0, 0.0, 2.0),
    vec3<f32>(-1.0, 0.0, 1.0)
);

const sobel_y: array<vec3<f32>, 3> = array<vec3<f32>, 3>(
    vec3<f32>(-1.0, -2.0, -1.0),
    vec3<f32>(0.0, 0.0, 0.0),
    vec3<f32>(1.0, 2.0, 1.0)
);

fn sobelFilter(texture: texture_2d<f32>, position: vec2<i32>) -> vec2<f32> {
    var result_x: f32 = 0.0;
    var result_y: f32 = 0.0;

    for (var y: i32 = -1; y <= 1; y++) {
        for (var x: i32 = -1; x <= 1; x++) {
            let texCoord = position + vec2(x, y);
            let texel: vec4<f32> = textureLoad(texture, texCoord, 0);
            result_x += texel.r * sobel_x[y + 1][x + 1];
            result_y += texel.r * sobel_y[y + 1][x + 1];
        }
    }

    let angle: f32 = atan2(result_y, result_x);
    let magnitude = sqrt(result_x * result_x + result_y * result_y);

    return vec2<f32>(magnitude, (angle + 3.14159265) / (2.0 * 3.14159265));
}

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4f {
    let downscale = vec2(i32(FragCoord.x / 8) * 8, i32(FragCoord.y / 8) * 8);
    let color = textureLoad(frameTexture, downscale, 0);

    let sobel = sobelFilter(frameTexture, vec2(i32(FragCoord.x), i32(FragCoord.y)));

    let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    let quantized = floor(luminance * 10) / 10;

    let offset = min(quantized, 0.9) * 80.0;
    let asciiPixel = textureLoad(asciiTexture, vec2(i32(offset + FragCoord.x % 8), i32(FragCoord.y % 8)), 0);

    if sobel.x < 0.1 {
        // return vec4f(0);
        return 0.5 * color + asciiPixel * color;
    }

    var borderColor = vec4f(1.0);
    if (sobel.y <= 0.0625 || sobel.y > 0.9375) || (sobel.y > 0.4375 && sobel.y <= 0.5625) {
        borderColor = vec4f(1.0, 0.0, 0.0, 1.0);
    } else if (sobel.y > 0.0625 && sobel.y <= 0.1875) || (sobel.y > 0.5625 && sobel.y <= 0.6875) {
        borderColor = vec4f(0.0, 1.0, 0.0, 1.0);
    } else if (sobel.y > 0.1875 && sobel.y <= 0.3125) || (sobel.y > 0.6875 && sobel.y <= 0.8125) {
        borderColor = vec4f(0.0, 0.0, 1.0, 1.0);
    } else {
        borderColor = vec4f(1.0, 0.0, 1.0, 1.0);
    }

    return borderColor + 0.5 * color + asciiPixel * color;
}
