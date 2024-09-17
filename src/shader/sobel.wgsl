@group(0) @binding(0) var raymarchTexture: texture_2d<f32>;
@group(0) @binding(1) var sobelTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;

var<workgroup> sharedDirectionCounts: array<atomic<u32>, 8>;

@compute @workgroup_size(8, 8)
fn f(@builtin(global_invocation_id) global_id: vec3u) {
    var sobel = vec2f(0);
    let pos = vec2i(global_id.xy);

    const kernel = array(
        vec3f(-1, 0, 1),
        vec3f(-2, 0, 2),
        vec3f(-1, 0, 1)
    );

    // Apply Sobel filter (https://en.wikipedia.org/wiki/Sobel_operator)
    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let texCoord = pos + vec2i(dx, dy);

            if textureLoad(maskTexture, texCoord, 0).x > 0.7 {
                let red = textureLoad(raymarchTexture, texCoord, 0).x;
                sobel += vec2(red * kernel[dy + 1][dx + 1], red * kernel[dx + 1][dy + 1]);
            }
        }
    }

    // let magnitude = sqrt(x * x + y * y);
    // let angle = atan2(y, x);
    // let normalized = (angle + 3.1416) / (2.0 * 3.1416);
    // let normalized = (atan2(y, x) + 3) / 6;

    if length(sobel) >= 0.2 {
        // let direction = u32(((((atan2(y, x) + 3) / 6) + 1.0 / 16.0) % 1.0) * 8.0);
        atomicAdd(&sharedDirectionCounts[u32(((((atan2(sobel.y, sobel.x) + 3) / 6) + 1.0 / 16.0) % 1.0) * 8.0)], 1);
    }

    workgroupBarrier();

    // Find the most common direction within the 8x8 area
    var mostCommonDirection = 0.0;
    var maxCount = 0u;
    for (var i = 0u; i < 8u; i++) {
        // This seems to compress better than inlining it
        let count = atomicLoad(&sharedDirectionCounts[i]);
        if atomicLoad(&sharedDirectionCounts[i]) > maxCount {
            maxCount = count;
            mostCommonDirection = f32(i) / 8.0;
        }
    }

    textureStore(sobelTexture, pos, vec4(
        mostCommonDirection,
        f32(maxCount),
        0.0,
        0.0
    ));
}
