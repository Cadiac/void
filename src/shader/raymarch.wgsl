const MAX_DIST = 250.0;
const EPSILON = 0.001;

// const FOG_COLOR = vec3(0.98, 1.0, 0.96);
// const SKY_COLOR = vec3(0.5);
// const FOG_COLOR = vec3(0.6, 0.5, 0.9);
// const SKY_COLOR = vec3(0.2, 0.2, 0.4);

struct Uniforms {
    camera: vec3f,
    lookAt: vec3f, 
    resolution: vec2f,
    time: f32,
    beat: f32,
};

// fn maxf(a: vec3f, b: f32) -> f32 {
//     let x = max(a.x, b);
//     let y = max(a.y, b);
//     let z = max(a.z, b);
//     return max(max(x, y), z);
// }

// http://en.wikipedia.org/wiki/Rotation_matrix#Basic_rotations
// fn rotateX(theta: f32) -> mat3x3<f32> {
//     let s = sin(theta);
//     let c = cos(theta);
//     return mat3x3(vec3(1, 0, 0), vec3(0, c, -s), vec3(0, s, c));
// }

// fn rotateY(theta: f32) -> mat3x3<f32> {
//     let s = sin(theta);
//     let c = cos(theta);
//     return mat3x3(vec3(c, 0, s), vec3(0, 1, 0), vec3(-s, 0, c));
// }

// fn rotateZ(theta: f32) -> mat3x3<f32> {
//     let s = sin(theta);
//     let c = cos(theta);
//     return mat3x3(vec3(c, -s, 0), vec3(s, c, 0), vec3(0, 0, 1));
// }

fn sphere(pos: vec3f, radius: f32) -> f32 {
    return length(pos) - radius;
}

fn cube(pos: vec3f, dimensions: vec3f) -> f32 {
    let q = abs(pos) - dimensions;
    return length(max(max(max(q.x, 0.0), max(q.y, 0.0)), max(q.z, 0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// fn plane(pos: vec3f, up: vec3f, height: f32) -> f32 {
//     // "up" must be normalized
//     return dot(pos, up) + height;
// }

// fn opUnion(a: Surface, b: Surface) -> Surface {
//     if a.distance < b.distance {
//         return a;
//     }
//     return b;
// }

fn opSubtraction(a: f32, b: f32) -> f32 {
    return max(-a, b);
}

fn opRepeat(p: vec3f, s: vec3f) -> vec3f {
    return p - s * round(p / s);
}

fn scene(pos: vec3f) -> f32 {
    let q = opRepeat(pos, vec3f(4.5 + sin(uniforms.time * 0.0001)));
    // let qq = opRepeat(pos - vec3f(5.0), vec3f(10.0));

    // let dist = cube(
    //     rotateX(uniforms.time * 0.0005) * rotateY(uniforms.time * 0.0005) * rotateZ(uniforms.time * 0.0005) * pos, vec3(4.0)
    // );

    // let dist = min(sphere(pos, 10.0), cube(pos - vec3f(0.0, 20.0, 0.0), vec3(5.0)));

    let dist = opSubtraction(
        sphere(q, 3.0),
        cube(pos, vec3(20.0))
    );

    return dist;
}

fn rayMarch(pos: vec3f, rayDir: vec3f) -> f32 {
    var stepDist = EPSILON;
    var depth = EPSILON;

    for (var i = 0; i < 250; i++) {
        stepDist = 0.001 * depth;

        let dist = scene(pos + depth * rayDir);

        if dist < stepDist {
            return depth;
        }

        depth += dist * 0.5;

        if depth >= MAX_DIST {
            return depth;
        }
    }

    return depth;
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn f(@builtin(position) FragCoord: vec4f) -> @location(0) vec4f {
    // let uv = FragCoord.xy - uniforms.resolution.xy / 2.0;
    // let w = uniforms.resolution.y / tan(radians(60.0) / 2.0);

    // lookAt
    // let s = normalize(cross(normalize(vec3(0.0, -1.0, 0.0)), f));
    let l = normalize(uniforms.lookAt - uniforms.camera);
    let s = normalize(cross(vec3(0.0, -1.0, 0.0), l));
    var dir = (mat4x4(
        vec4(s, .0), vec4(cross(l, s), .0), vec4(-l, .0), vec4(.0, .0, .0, 1.)) *                                       // viewToWorld
        vec4(normalize(vec3(FragCoord.xy - uniforms.resolution.xy / 2.0, -(uniforms.resolution.y / 0.6))), 0.0)).xyz;   // viewDir

    let sunDir = normalize(vec3(1, 2, 3));

    // render
    var color = vec3(0.0);
    var reflection = 1.0;

    var rayDist = 0.0;
    var dist = rayMarch(uniforms.camera, dir);
    var pos = uniforms.camera + dist * dir;

    for (var i = 0; i < 4; i++) {
        // Sky
        if dist >= MAX_DIST {
            // Deeper blue when looking up
            var sky_color = vec3(0.1) - 0.5 * dir.y;

            // Fade to fog further away
            let dist = (25000. - uniforms.camera.y) / dir.y;
            let e = exp2(-abs(dist) * vec3(0.0001));
            sky_color = sky_color * e + (1.0 - e) * vec3(0.98, 1.0, 0.96);

            // Sun
            let dotSun = dot(sunDir, dir);
            if dotSun > 0.99 {
                let h = dir.y - sunDir.y;
                sky_color = vec3(0.9);
            }

            color = mix(color, sky_color, reflection);
            break;
        }

        // Tetrahedron technique, https://iquilezles.org/articles/normalsSDF/, MIT
        const k = vec2(1, -1);
        let normal = normalize(
            k.xyy * scene(pos + k.xyy * EPSILON) +
            k.yyx * scene(pos + k.yyx * EPSILON) +
            k.yxy * scene(pos + k.yxy * EPSILON) +
            k.xxx * scene(pos + k.xxx * EPSILON)
        );

        rayDist += dist;

        // Soft shadows
        // var shadow = 1.0;
        // var depth = 1.0;

        // for (var s = 0; s < 250; s++) {
        //     if depth >= MAX_DIST {
        //         break;
        //     }

        //     let dist = scene(pos + depth * sunDir);
        //     if dist < EPSILON {
        //         shadow = 0.0;
        //         break;
        //     }
        //     shadow = min(shadow, 50.0 * dist / depth);
        //     depth += dist;
        // }

        let e = exp2(-rayDist * 0.05 * vec3(1.0));                                                  // Fog
        // color = mix(color, (
        //     vec3(0.0) +                                                                             // Ambient
        //     vec3(0.1) * clamp(dot(sunDir, normal) * shadow, 0.0, 1.0) +                             // Diffuse
        //     vec3(0.8) * pow(clamp(dot(reflect(sunDir, normal) * shadow, dir), 0.0, 1.0), 10.0)      // Specular
        // ) * e + (1.0 - e) * vec3(0.98, 1.0, 0.96), reflection);                                     // Fog color

        color = mix(color, (
            vec3(0.0) +                                                                             // Ambient
            vec3(0.1) * clamp(dot(sunDir, normal), 0.0, 1.0) +                                      // Diffuse
            vec3(0.8) * pow(clamp(dot(reflect(sunDir, normal), dir), 0.0, 1.0), 10.0)               // Specular
        ) * e + (1.0 - e) * vec3(0.98, 1.0, 0.96), reflection);                                     // Fog color

        reflection *= 0.5;

        dir = reflect(dir, normal);
        dist = rayMarch(pos, dir);
        pos = pos + dist * dir;
    }

    // Fade in
    // if uniforms.time < 5000.0 {
    //     color = mix(color, vec3(0.0), (5000.0 - uniforms.time) / 5000.0);
    // }

    // color.x = smoothstep(0.0, 1.0, color.x);
    // color.y = smoothstep(0.0, 1.0, color.y);
    // color.z = smoothstep(0.0, 1.0, color.z);

    return vec4f(color, 1.0);
}
