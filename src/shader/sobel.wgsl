@group(0) @binding(0) var frameTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;

var<workgroup> sharedDirectionCounts: array<atomic<u32>, 8>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    var xy = vec2f(0);
    // var y = 0.0;
    let pos = vec2i(global_id.xy);

    // Initialize shared memory - doesn't seem mandatory
    // if global_id.x == 0u && global_id.y == 0u {
    //     for (var i = 0; i < 8; i++) {
    //         atomicStore(&sharedDirectionCounts[i], 0u);
    //     }
    // }

    // workgroupBarrier();

    const kernel = array(
        vec3f(-1, 0, 1),
        vec3f(-2, 0, 2),
        vec3f(-1, 0, 1)
    );

    // Apply Sobel filter
    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let texCoord = pos + vec2i(dx, dy);
            // let maskPixel = textureLoad(maskTexture, texCoord, 0);

            if textureLoad(maskTexture, texCoord, 0).x > 0.7 {
                let texel = textureLoad(frameTexture, texCoord, 0);
                xy += vec2(texel.x * kernel[dy + 1][dx + 1], texel.x * kernel[dx + 1][dy + 1]);
            }

            // y += texel.r * kernel[dx + 1][dy + 1];
        }
    }

    // let magnitude = sqrt(x * x + y * y);
    // let angle = atan2(y, x);
    // let normalized = (angle + 3.1416) / (2.0 * 3.1416);
    // let normalized = (atan2(y, x) + 3) / 6;

    if length(xy) >= 0.2 {
        // let direction = u32(((((atan2(y, x) + 3) / 6) + 1.0 / 16.0) % 1.0) * 8.0);
        atomicAdd(&sharedDirectionCounts[u32(((((atan2(xy.y, xy.x) + 3) / 6) + 1.0 / 16.0) % 1.0) * 8.0)], 1);
    }

    workgroupBarrier();

    // Find the most common direction within the 8x8 area
    // var isEdgeTile = 0.0;
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

    textureStore(outputTexture, pos, vec4(
        mostCommonDirection,
        f32(maxCount),
        0.0,
        0.0
    ));
}
