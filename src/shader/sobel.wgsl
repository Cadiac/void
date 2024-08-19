struct Uniforms {
    threshold: f32,
};

@group(0) @binding(0) var frameTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

var<workgroup> sharedDirectionCounts: array<atomic<u32>, 8>;

const kernel = array<vec3f, 3>(
    vec3f(-1.0, 0.0, 1.0),
    vec3f(-2.0, 0.0, 2.0),
    vec3f(-1.0, 0.0, 1.0)
);

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    var x = 0.0;
    var y = 0.0;
    let pos = vec2i(global_id.xy);

    // Initialize shared memory
    if global_id.x == 0u && global_id.y == 0u {
        for (var i = 0; i < 8; i++) {
            atomicStore(&sharedDirectionCounts[i], 0u);
        }
    }

    workgroupBarrier();

    // Apply Sobel filter
    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            let texCoord = pos + vec2<i32>(dx, dy);
            let maskPixel = textureLoad(maskTexture, texCoord, 0);
            var texel = textureLoad(frameTexture, texCoord, 0);

            if maskPixel.r < 0.7 {
                texel = vec4f(0.0);
            }

            x += texel.r * kernel[dy + 1][dx + 1];
            y += texel.r * kernel[dx + 1][dy + 1];
        }
    }

    let magnitude: f32 = sqrt(x * x + y * y);
    let angle: f32 = atan2(y, x);
    let normalizedAngle: f32 = (angle + 3.1416) / (2.0 * 3.1416);

    if magnitude >= uniforms.threshold {
        let directionIndex: u32 = u32(((normalizedAngle + 1.0 / 16.0) % 1.0) * 8.0);
        atomicAdd(&sharedDirectionCounts[directionIndex], 1u);
    }

    workgroupBarrier();

    // Find the most common direction within the 8x8 area
    var isEdgeTile = 0.0;
    var mostCommonDirection = 0u;
    var maxCount = 0u;
    for (var i = 0u; i < 8u; i++) {
        let count = atomicLoad(&sharedDirectionCounts[i]);
        if count > maxCount {
            maxCount = count;
            mostCommonDirection = i;
            isEdgeTile = 1.0;
        }
    }

    let outputColor = vec4f(
        f32(mostCommonDirection) / 8.0,
        isEdgeTile,
        0.0,
        1.0
    );

    textureStore(outputTexture, pos, outputColor);
}
