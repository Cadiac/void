@vertex
fn vs(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(position, 0.0, 1.0);
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct Camera {
    position: vec3<f32>,
    lookAt: vec3<f32>,
};

struct Light {
    position: vec3<f32>,
};

struct Uniforms {
    camera: Camera,
    resolution: vec2<f32>,
    sun: Light,
};

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = (FragCoord.xy - uniforms.resolution * 0.5) / uniforms.resolution.y;

    return vec4<f32>(uv.xy, 0.0, 1.0);
}
