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

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4f {
    let downscale = vec2(i32(FragCoord.x / 8) * 8, i32(FragCoord.y / 8) * 8);

    let color = textureLoad(frameTexture, downscale, 0);

    let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

    var offset = min(floor(luminance * 10), 9) * 8.0;
    let asciiPixel = textureLoad(asciiTexture, vec2(i32(offset + FragCoord.x % 8), i32(FragCoord.y % 8)), 0);

    return asciiPixel;
}
