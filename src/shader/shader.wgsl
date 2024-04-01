struct Particle {
    position: vec3<f32>,
    density: f32,
    pressure: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec3<f32>,
};

@vertex
fn vs(@builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec4<f32>,
    @location(1) uv: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    let particlePosition = particles[instanceIndex].position;

    output.Position = vec4<f32>(position.xyz + particlePosition, 1.0);
    output.uv = uv;
    output.color = vec3<f32>(particles[instanceIndex].density, 0.0, 0.0);

    return output;
}

@fragment
fn fs(@location(0) uv: vec2<f32>, @location(1) color: vec3<f32>) -> @location(0) vec4<f32> {
    // let centreOffset = (uv.xy - 0.5) * 2;
    // let sqrDst = dot(centreOffset, centreOffset);
    // let delta = fwidth(sqrt(sqrDst));
    // let alpha = 1 - smoothstep(1 - delta, 1 + delta, sqrDst);

    let center = vec2<f32>(0.5, 0.5);
    let radius = 1.0;
    let distanceFromCenter = distance(uv, center);

    if distanceFromCenter > radius {
        discard;
    }

    return vec4<f32>(color, 1.0);
}