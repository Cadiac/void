struct Particle {
    position: vec3f,
    pressure: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};


@vertex
fn vs(@builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec4<f32>,
    @location(1) uv: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    let particlePosition = particles[instanceIndex].position;
    output.Position = vec4<f32>(position.xyz + particlePosition, 1.0);
    output.uv = uv;
    return output;
}

@fragment
fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let center = vec2<f32>(0.5, 0.5); // Assuming UVs are normalized [0,1]
    let radius = 0.5;
    let distanceFromCenter = distance(uv, center);
    if distanceFromCenter > radius {
    discard;
    }
    return vec4<f32>(1.0, 1.0, 1.0, 1.0); // White circle
}