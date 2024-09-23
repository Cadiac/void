// The following functions and raymarching algorithms are derived from iq's
// brilliant website, published under MIT license:
// - https://iquilezles.org/articles/distfunctions/ - opUnion, opSubtraction, opRepeat, sdSphere, sdBox
// - https://iquilezles.org/articles/raymarchingdf/ - rayMarching
// - https://iquilezles.org/articles/normalsSDF/, Tetrahedron technique
//
// These functions were converted to WGSL and manually inlined (as wgslminifier is lacking support for this)
// License of the original code:
// 
// The MIT License
// Copyright © 2019 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
// WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
// TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
// FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
// THE USE OR OTHER DEALINGS IN THE SOFTWARE.

fn scene(pos: vec3f) -> f32 {
    // Cube (20 x 20 x 20)
    let q = abs(pos) - vec3(20.0);

    // Repeated spheres every 4.5 units (opRepeat)
    let s = vec3f(4.5 + sin(uniforms.z));

    return min(                                                                                                 // opUnion
        max(                                                                                                    // opSubttraction
            -length(pos - s * round(pos / s)) + 3.0,                                                            // sdSphere
            length(max(max(max(q.x, 0.0), max(q.y, 0.0)), max(q.z, 0.0))) + min(max(q.x, max(q.y, q.z)), 0.0)   // sdBox
        ),
        length(pos) - 1.5 - 0.2 * uniforms.w                                                                    // sdSphere
    );
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

// Originally the uniforms were passed as a struct, but just using a vec4f saves some space.
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
    // let camera = vec3f(5 + uniforms.z, 0, 0);

    let l = normalize(-camera);
    let s = normalize(cross(vec3(0.0, -1.0, 0.0), l));
    var dir = (mat4x4(
        vec4(s, .0), vec4(cross(l, s), .0), vec4(-l, .0), vec4(.0, .0, .0, 1.)) *                 // viewToWorld
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

        // Normals using tetrahedron technique
        const k = vec2(1, -1);
        let normal = normalize(
            k.xyy * scene(pos + k.xyy * 0.001) +
            k.yyx * scene(pos + k.yyx * 0.001) +
            k.yxy * scene(pos + k.yxy * 0.001) +
            k.xxx * scene(pos + k.xxx * 0.001)
        );

        rayDist += dist;


        let e = exp2(-rayDist * 0.05 * vec3(1.0));              // Fog

        var diffuse = vec3(0.7, 0.55, 0.5);
        if (length(pos) < 2) {
            diffuse = uniforms.w * 2 * vec3(1.0, 0.6, 0.0);
        } 

        color = mix(color, (
            vec3(0.1) +                                         // Ambient
            diffuse * clamp(dot(sunDir, normal), 0.0, 1.0)      // Diffuse
        ) * e + (1.0 - e) * vec3(1.0), reflection);             // Fog color

        reflection *= 0.5;
        if (length(pos) < 2) {
            reflection = 0.1;
        }

        dir = reflect(dir, normal);
        dist = rayMarch(pos, dir);
        pos = pos + dist * dir;
    }

    // Blank background for the "shell" screen at the beginning/end
    if uniforms.z < 1 || uniforms.z > 10.8 {
        color = vec3(0.6, 0.55, 0.5);
    }

    return vec4f(color, 1.0);
}
