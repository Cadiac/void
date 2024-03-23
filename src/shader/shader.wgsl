struct Uniforms {
  resolution: vec2f,
  sun: vec3f,
  camera: vec3f,
  cameraDir: vec3f,
}

struct Ray {
  surface: vec2f,
  pos: vec3f,
  hit: bool,
}

const EPSILON = 0.0001;
const MAX_ITERATIONS = 100;
const MAX_DIST = 100.0;
const FOV = 60;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    let pos = array<vec2f, 4>(vec2f(-1, 1), vec2f(-1), vec2f(1), vec2f(1, -1));
    return vec4f(pos[vertexIndex], 0, 1);
}

fn sdSphere(p: vec3f, s: f32) -> f32 {
    return length(p) - s;
}

fn scene(p: vec3f) -> vec2f {
    return vec2f(1.0, sdSphere(p, 1.0));
}

fn lookAt(camera: vec3f, cameraDir: vec3f, up: vec3f) -> mat4x4f {
    let f = normalize(cameraDir - camera);
    let s = normalize(cross(up, f));
    let u = cross(f, s);

    let viewMatrix = mat4x4f(
        vec4f(s, 0.0),
        vec4f(u, 0.0),
        vec4f(-f, 0.0),
        vec4f(0.0, 0.0, 0.0, 1.0)
    );

    let translateMatrix = mat4x4f(
        vec4f(1.0, 0.0, 0.0, 0.0),
        vec4f(0.0, 1.0, 0.0, 0.0),
        vec4f(0.0, 0.0, 1.0, 0.0),
        vec4f(-camera, 1.0)
    );

    return viewMatrix * translateMatrix;
}


fn rayMarch(camera: vec3f, rayDir: vec3f) -> Ray {
    var stepDist: f32 = EPSILON;
    var dist: f32 = EPSILON;
    var depth: f32 = EPSILON;

    var result: Ray = Ray(vec2f(0.0, 0.0), vec3f(0.0, 0.0, 0.0), false);

    for (var i: i32 = 0; i < MAX_ITERATIONS; i = i + 1) {
        stepDist = 0.001 * depth;
        result.pos = camera + depth * rayDir;
        result.surface = scene(result.pos);

        if result.surface.y < stepDist {
            result.hit = true;
            break;
        }

        depth += result.surface.y;

        if depth >= MAX_DIST {
            break;
        }
    }

    result.surface.y = depth;

    return result;
}

fn render(camera: vec3f, cameraDir: vec3f, sunDir: vec3f, xy: vec2f, z: f32) -> vec3f {
    let viewToWorld: mat4x4f = lookAt(camera, cameraDir, vec3f(0.0, 1.0, 0.0));
    let viewDir: vec3f = normalize(vec3f(xy, -z));
    let rayDirVec4: vec4f = viewToWorld * vec4f(viewDir, 0.0);
    let rayDir: vec3f = rayDirVec4.xyz;

    var color: vec3f = vec3f(0.0, 0.0, 0.0);

    let ray: Ray = rayMarch(camera, rayDir);

    if !ray.hit {
        // color = sky(camera, rayDir, sunDir);
        // Add sun glow or other effects based on your logic
        color += 0.5 * vec3f(1.0, 0.5, 0.2) * pow(clamp(dot(sunDir, rayDir), 0.0, 1.0), 10.0);
        return color;
    }

    // Tetrahedron technique, https://iquilezles.org/articles/normalsSDF/, MIT
    let k1: vec3f = vec3f(1.0, -1.0, -1.0);
    let k2: vec3f = vec3f(-1.0, -1.0, 1.0);
    let k3: vec3f = vec3f(-1.0, 1.0, -1.0);
    let k4: vec3f = vec3f(1.0, 1.0, 1.0);

    let normal = normalize(
        k1 * scene(ray.pos + k1 * EPSILON).y + k2 * scene(ray.pos + k2 * EPSILON).y + k3 * scene(ray.pos + k3 * EPSILON).y + k4 * scene(ray.pos + k4 * EPSILON).y
    );

    let light = 0.5 + 0.5 * normal;

    var fresnel = clamp(1. + dot(rayDir, normal), 0., 1.);
    fresnel = 0.5 + (0.01 + 0.4 * pow(fresnel, 3.5));

    color = mix(color, light, fresnel);

    return color;
}


@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let xy = pos.xy - uniforms.resolution / 2.0;
    let z = uniforms.resolution.y / tan(radians(FOV) / 2.0);

    let sunDir = normalize(uniforms.sun);

    let color = render(uniforms.camera, uniforms.cameraDir, sunDir, xy, z);

    return vec4f(color, 1.0);
}