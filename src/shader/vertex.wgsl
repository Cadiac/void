@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    let pos = array(
        vec2f(-1.0, -1.0), // bottom left
        vec2f(1.0, -1.0),  // bottom right
        vec2f(-1.0, 1.0),  // top left
        vec2f(-1.0, 1.0),  // bottom right
        vec2f(1.0, -1.0),  // top right
        vec2f(1.0, 1.0),   // top left
    );

    let uv = pos[vertexIndex];

    return vec4f(uv, 0.0, 1.0);
}
