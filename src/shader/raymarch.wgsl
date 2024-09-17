fn sphere(pos: vec3f, radius: f32) -> f32 {
    return length(pos) - radius;
}

fn opSubtraction(a: f32, b: f32) -> f32 {
    return max(-a, b);
}

fn opRepeat(p: vec3f, s: vec3f) -> vec3f {
    return p - s * round(p / s);
}

fn scene(pos: vec3f) -> f32 {
    // Cube (20 x 20 x 20)
    let q = abs(pos) - vec3(20.0);

    return min(opSubtraction(
        sphere(opRepeat(pos, vec3f(4.5 + sin(uniforms.z))), 3.0),
        length(max(max(max(q.x, 0.0), max(q.y, 0.0)), max(q.z, 0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) // Cube
    ), sphere(pos, 1.5 + 0.2 * uniforms.w));
}

fn rayMarch(pos: vec3f, rayDir: vec3f) -> f32 {
    var stepDist = 0.001;
    var depth = 0.001;

    for (var i = 0; i < 250; i++) {
        stepDist = 0.001 * depth;

        let dist = scene(pos + depth * rayDir);

        if dist < stepDist {
            return depth;
        }

        depth += dist * 0.5;

        if depth >= 250 {
            return depth;
        }
    }

    return depth;
}

// Instead of this struct, just pass a vec4f
// struct Uniforms {
//     resolution: vec2f, // uniforms.xy
//     time: f32,         // uniforms.z
//     beat: f32,         // uniforms.w
// };

@group(0) @binding(0) var<uniform> uniforms: vec4f;

@fragment
fn f(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    // let uv = FragCoord.xy - uniforms.resolution.xy / 2.0;
    // let w = uniforms.resolution.y / tan(radians(60.0) / 2.0);

    // lookAt
    // let s = normalize(cross(normalize(vec3(0.0, -1.0, 0.0)), f));
    // let l = normalize(uniforms.lookAt - uniforms.camera);
    let camera = vec3f(7 * sin(uniforms.z), 0, 7 * cos(uniforms.z));

    let l = normalize(-camera);
    let s = normalize(cross(vec3(0.0, -1.0, 0.0), l));
    var dir = (mat4x4(
        vec4(s, .0), vec4(cross(l, s), .0), vec4(-l, .0), vec4(.0, .0, .0, 1.)) *                                       // viewToWorld
        vec4(normalize(vec3(FragCoord.xy - uniforms.xy / 2.0, -(uniforms.y / 0.6))), 0.0)).xyz;   // viewDir

    let sunDir = normalize(vec3(1, 2, 3));

    // render
    var color = vec3(0.0);
    var reflection = 1.0;

    var rayDist = 0.0;
    var dist = rayMarch(camera, dir);
    var pos = camera + dist * dir;

    for (var i = 0; i < 4; i++) {
        // Sky
        if dist >= 250 {
            color = mix(color, vec3(1.0), reflection);
            break;
        }

        // Tetrahedron technique, https://iquilezles.org/articles/normalsSDF/, MIT
        const k = vec2(1, -1);
        let normal = normalize(
            k.xyy * scene(pos + k.xyy * 0.001) +
            k.yyx * scene(pos + k.yyx * 0.001) +
            k.yxy * scene(pos + k.yxy * 0.001) +
            k.xxx * scene(pos + k.xxx * 0.001)
        );

        rayDist += dist;


        let e = exp2(-rayDist * 0.05 * vec3(1.0));                                                  // Fog

        var diffuse = vec3(0.5);
        if (sphere(pos, 2.5) < 0.0) {
            diffuse = uniforms.w * 2 * vec3(1.0, 0.6, 0.0);
        } 

        color = mix(color, (
            vec3(0.1) +                                                                             // Ambient, TODO maybe remove?
            diffuse * clamp(dot(sunDir, normal), 0.0, 1.0)                                          // Diffuse
            // vec3(0.8) * pow(clamp(dot(reflect(sunDir, normal), dir), 0.0, 1.0), 10.0)            // Specular
        ) * e + (1.0 - e) * vec3(1.0), reflection);                                                 // Fog color

        reflection *= 0.5;
        if (sphere(pos, 2.5) < 0.0) {
            reflection = 0.1;
        }

        dir = reflect(dir, normal);
        dist = rayMarch(pos, dir);
        pos = pos + dist * dir;
    }

    if uniforms.z < 1 {
        color = vec3(0.5);
    }

    return vec4f(color, 1.0);
}
