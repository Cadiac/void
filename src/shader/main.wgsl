const MAX_DIST = 250.0;
const EPSILON = 0.00001;

const FOG_COLOR = vec3(0.5, 0.4, 0.3);
const COLOR_SHIFT = vec3(1., .92, 1.);
const SKY_COLOR = vec3(0.8);

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

    let uv = pos[vertexIndex];

    return vec4f(uv, 0.0, 1.0);
}

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
    time: f32,
};

struct Surface {
  id: i32,
  distance: f32,
};

struct Ray {
  surface: Surface,
  position: vec3<f32>,
  isHit: bool,
};

fn maxf(a: vec3<f32>, b: f32) -> f32 {
    let x = max(a.x, b);
    let y = max(a.y, b);
    let z = max(a.z, b);
    return max(max(x, y), z);
}

// http://en.wikipedia.org/wiki/Rotation_matrix#Basic_rotations
fn rotateX(theta: f32) -> mat3x3<f32> {
    let s = sin(theta);
    let c = cos(theta);
    return mat3x3(vec3(1, 0, 0), vec3(0, c, -s), vec3(0, s, c));
}

fn rotateY(theta: f32) -> mat3x3<f32> {
    let s = sin(theta);
    let c = cos(theta);
    return mat3x3(vec3(c, 0, s), vec3(0, 1, 0), vec3(-s, 0, c));
}

fn rotateZ(theta: f32) -> mat3x3<f32> {
    let s = sin(theta);
    let c = cos(theta);
    return mat3x3(vec3(c, -s, 0), vec3(s, c, 0), vec3(0, 0, 1));
}


fn sphere(position: vec3<f32>, radius: f32) -> f32 {
    return length(position) - radius;
}

fn cube(position: vec3<f32>, dimensions: vec3<f32>) -> f32 {
    let q = abs(position) - dimensions;
    return length(maxf(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn plane(position: vec3<f32>, up: vec3<f32>, height: f32) -> f32 {
    // "up" must be normalized
    return dot(position, up) + height;
}

fn opUnion(a: Surface, b: Surface) -> Surface {
    if a.distance < b.distance {
        return a;
    }
    return b;
}

fn scene(position: vec3<f32>) -> Surface {
    let s = Surface(1, sphere(position - vec3(0.0, 7.0, 0.0), 4.0));
    let c = Surface(2, cube(
        rotateX(uniforms.time * 0.0005) * rotateY(uniforms.time * 0.0005) * rotateZ(uniforms.time * 0.0005) * position, vec3(1.0)
    ));

    let p = Surface(3, plane(position, vec3(0.0, 1.0, 0.0), 10.0));

    var surface = opUnion(
        s,
        c
    );
    surface = opUnion(
        surface,
        p
    );

    return surface;
}

fn sky(camera: Camera, rayDir: vec3<f32>, sunDir: vec3<f32>) -> vec3<f32> {
    // Deeper blue when looking up
    var color = SKY_COLOR - 0.5 * rayDir.y;

    // Fade to fog further away
    let dist = (25000. - camera.position.y) / rayDir.y;
    let e = exp2(-abs(dist) * EPSILON * COLOR_SHIFT);
    color = color * e + (1.0 - e) * FOG_COLOR;

    // Sun
    let dotSun = dot(sunDir, rayDir);
    if dotSun > 0.9999 {
        let h = rayDir.y - sunDir.y;
        color = vec3(0.9);
    }

    return color;
}


fn rayMarch(position: vec3<f32>, rayDir: vec3<f32>) -> Ray {
    var stepDist = EPSILON;
    var depth = EPSILON;

    var result: Ray;

    for (var i = 0; i < 250; i++) {
        stepDist = 0.001 * depth;

        result.position = position + depth * rayDir;
        result.surface = scene(result.position);

        if result.surface.distance < stepDist {
            result.isHit = true;
            break;
        }

        depth += result.surface.distance * 0.5;

        if depth >= MAX_DIST {
            break;
        }
    }

    result.surface.distance = depth;

    return result;
}

fn softShadows(sunDir: vec3<f32>, position: vec3<f32>, k: f32) -> f32 {
    var opacity = 1.0;
    var depth = 1.0;

    for (var s = 0; s < 250; s++) {
        if depth >= MAX_DIST {
            return opacity;
        }

        let surface = scene(position + depth * sunDir);
        if surface.distance < EPSILON {
            return 0.0;
        }
        opacity = min(opacity, k * surface.distance / depth);
        depth += surface.distance;
    }

    return opacity;
}

fn lightning(sunDir: vec3<f32>, normal: vec3<f32>, position: vec3<f32>, rayDir: vec3<f32>,
    rayDist: f32) -> vec3<f32> {

    let ambient = vec3(0.2); // TODO: ambient
    let diffuseColor = vec3(0.5); // TODO: diffuse
    let specularColor = vec3(0.8); // TODO: specular
    let hardness = 10.0; // TODO: hardness

    let shadow = softShadows(sunDir, position, 10.0);
    let dotLN = clamp(dot(sunDir, normal) * shadow, 0.0, 1.0);
    let diffuse = diffuseColor * dotLN;

    let dotRV = clamp(dot(reflect(sunDir, normal), rayDir), 0.0, 1.0);
    let specular = specularColor * pow(dotRV, hardness);

    let color = ambient + diffuse + specular;

    // Fog
    let e = exp2(-rayDist * 0.05 * COLOR_SHIFT);
    return color * e + (1.0 - e) * FOG_COLOR;
}

fn render(camera: Camera, rayDir: vec3<f32>, sunDir: vec3<f32>) -> vec3<f32> {
    var color = vec3(0.0);
    var reflection = 1.0;
    var dir = rayDir;

    var rayDist = 0.0;
    var ray = rayMarch(camera.position, dir);

    const bounces = 4;

    for (var i = 0; i < bounces; i++) {
        if !ray.isHit {
            color = mix(color, sky(camera, dir, sunDir), reflection);
            break;
        }

        // Tetrahedron technique, https://iquilezles.org/articles/normalsSDF/, MIT
        const k = vec2(1, -1);
        let a = k.xyy * scene(ray.position + k.xyy * EPSILON).distance;
        let b = k.yyx * scene(ray.position + k.yyx * EPSILON).distance;
        let c = k.yxy * scene(ray.position + k.yxy * EPSILON).distance;
        let d = k.xxx * scene(ray.position + k.xxx * EPSILON).distance;

        let normal = normalize(
            a + b + c + d
        );

        rayDist += ray.surface.distance;
        let newColor = lightning(sunDir, normal, ray.position, dir, rayDist);

        color = mix(color, newColor, reflection);

        // TODO: read reflection from material
        if ray.surface.id == 1 {
            reflection *= 0.5;
        } else {
            reflection = 0.0;
        }

        if reflection < EPSILON {
            break;
        }

        dir = reflect(dir, normal);
        ray = rayMarch(ray.position, dir);
    }


    return color;
}

fn lookAt(camera: Camera, up: vec3<f32>) -> mat4x4<f32> {
    let f = normalize(camera.lookAt - camera.position);
    let s = normalize(cross(up, f));
    let u = cross(f, s);

    return mat4x4(vec4(s, .0), vec4(u, .0), vec4(-f, .0), vec4(.0, .0, .0, 1.));
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs(@builtin(position) FragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = FragCoord.xy - uniforms.resolution.xy / 2.0;
    let w = uniforms.resolution.y / tan(radians(60.0) / 2.0);
    let up = normalize(vec3(0.0, -1.0, 0.0));

    let viewDir = normalize(vec3(uv, -w));
    let viewToWorld = lookAt(uniforms.camera, up);
    let rayDir = (viewToWorld * vec4(viewDir, 0.0)).xyz;

    let sunDir = normalize(vec3(1.0, 2.0, 3.0));

    var color = render(uniforms.camera, rayDir, sunDir);

    let fadeInDuration = 3000.0;
    if uniforms.time < fadeInDuration {
        color = mix(color, vec3(0.0), (fadeInDuration - uniforms.time) / fadeInDuration);
    }

    color.x = smoothstep(0.0, 1.0, color.x);
    color.y = smoothstep(0.0, 1.0, color.y);
    color.z = smoothstep(0.0, 1.0, color.z);

    return vec4<f32>(color, 1.0);
}
