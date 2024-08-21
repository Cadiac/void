const uv = array(
    vec2f(-1.0, -1.0), // bottom left
    vec2f(1.0, -1.0),  // bottom right
    vec2f(-1.0, 1.0),  // top left
    vec2f(-1.0, 1.0),  // bottom right
    vec2f(1.0, -1.0),  // top right
    vec2f(1.0, 1.0),   // top left
);

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    return vec4f(uv[vertexIndex], 0.0, 1.0);
}
