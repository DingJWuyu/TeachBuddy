/*
 * Signs the prototype session out so the entry screens stay reviewable.
 *
 * PROTOTYPE: the workbench does not own a session yet, so rather than thread a
 * sign-out control into its sidebar - which is measured against the reference
 * and must not move - the session is surfaced here, floating above the shell.
 * This is the seam that becomes the account menu when the entry screens are
 * integrated.
 */
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
