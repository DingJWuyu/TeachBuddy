/* Shows the current in-memory account and signs out without changing the sidebar layout. */
export default function SessionStrip({ user, onSignOut }) {
  if (!user) return null;

  return (
    <div className="ae-session" role="status">
      <span className="ae-session-who">
        <span className="ae-session-name">{user.name}</span>
        <span className="ae-session-email">{user.email}</span>
      </span>
      <button className="ae-session-out" type="button" onClick={onSignOut}>退出登录</button>
    </div>
  );
}
