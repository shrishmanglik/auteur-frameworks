# Main-push CI canary

This inert file accompanies the push-trigger wiring change. Its arrival on `main`
is the bounded canary: GitHub Actions must emit one `push` event run for the merged
commit, and the README badge pinned to `branch=main&event=push` must resolve from
`no status` to that run's conclusion.
