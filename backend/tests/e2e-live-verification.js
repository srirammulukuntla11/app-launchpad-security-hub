async function runE2E() {
  const baseUrl = 'http://localhost:5000';
  const timestamp = Date.now();
  console.log('--- STARTING LIVE E2E SYSTEM INTEGRATION TEST ---');

  // 1. Platform Owner Registration
  console.log('[1/12] Registering platform owner...');
  const ownerEmail = `demo_presenter_${timestamp}@example.com`;
  const regOwnerRes = await fetch(`${baseUrl}/api/v1/platform/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Demo Presenter', email: ownerEmail, password: 'SecurePassword123!' })
  });
  const regOwnerData = await regOwnerRes.json();
  if (regOwnerRes.status !== 201) throw new Error('Owner reg failed: ' + JSON.stringify(regOwnerData));
  console.log('  -> Owner registered successfully, ID:', regOwnerData.data.user.id);

  // 2. Platform Owner Login
  console.log('[2/12] Logging in platform owner...');
  const loginOwnerRes = await fetch(`${baseUrl}/api/v1/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'SecurePassword123!' })
  });
  const loginOwnerData = await loginOwnerRes.json();
  if (loginOwnerRes.status !== 200) throw new Error('Owner login failed: ' + JSON.stringify(loginOwnerData));
  const ownerAccessToken = loginOwnerData.data.accessToken;
  console.log('  -> Owner logged in successfully, in-memory token obtained.');

  // 3. Platform Owner Profile Check
  console.log('[3/12] Fetching platform owner profile (/me)...');
  const meRes = await fetch(`${baseUrl}/api/v1/platform/me`, {
    headers: { 'Authorization': `Bearer ${ownerAccessToken}` }
  });
  const meData = await meRes.json();
  if (meRes.status !== 200) throw new Error('Get me failed: ' + JSON.stringify(meData));
  console.log(`  -> Profile verified: ${meData.data.user.name} (${meData.data.user.email})`);

  // 4. Project Creation & One-Time Secret Reveal
  console.log('[4/12] Creating project with secure credentials...');
  const createProjRes = await fetch(`${baseUrl}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Presentation Demo App', slug: `demo-app-${timestamp}`, environment: 'development' })
  });
  const createProjData = await createProjRes.json();
  if (createProjRes.status !== 201) throw new Error('Project create failed: ' + JSON.stringify(createProjData));
  const project = createProjData.data.project;
  const credential = createProjData.data.credential;
  const oneTimeSecret = createProjData.data.oneTimeSecret;
  console.log('  -> Project created! ID:', project.id, 'Slug:', project.slug);
  console.log('  -> Public Key:', credential.publicKey);
  console.log('  -> One-Time Secret revealed?:', !!oneTimeSecret, 'length:', oneTimeSecret.length);

  // 5. Project Listing (Ensure secret not leaked)
  console.log('[5/12] Listing owner projects...');
  const listProjRes = await fetch(`${baseUrl}/api/v1/projects`, {
    headers: { 'Authorization': `Bearer ${ownerAccessToken}` }
  });
  const listProjData = await listProjRes.json();
  const projectsList = Array.isArray(listProjData.data) ? listProjData.data : listProjData.data.projects;
  const foundProj = projectsList.find(p => p.id === project.id);
  if (!foundProj) throw new Error('Project not found in list');
  const secretInList = JSON.stringify(listProjData).includes(oneTimeSecret);
  console.log('  -> Found in list. One-time secret leaked in listing?:', secretInList);
  if (secretInList) throw new Error('SECURITY VIOLATION: Secret leaked in project list!');

  // 6. Roles Provisioning & Listing
  console.log('[6/12] Listing / provisioning project roles...');
  const rolesRes = await fetch(`${baseUrl}/api/v1/projects/${project.id}/roles`, {
    headers: { 'Authorization': `Bearer ${ownerAccessToken}` }
  });
  const rolesData = await rolesRes.json();
  console.log('  -> Provisioned roles:', rolesData.data.map(r => r.name).join(', '));
  const viewerRole = rolesData.data.find(r => r.name === 'viewer');
  if (!viewerRole) throw new Error('Viewer role not found!');

  // 7. Application User Registration
  console.log('[7/12] Registering end-user in project scope...');
  const appUserEmail = `enduser_${timestamp}@client.com`;
  const regAppRes = await fetch(`${baseUrl}/api/v1/auth/${credential.publicKey}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: appUserEmail, password: 'UserSecretPassword123!', name: 'End User Alice' })
  });
  const regAppData = await regAppRes.json();
  if (regAppRes.status !== 201) throw new Error('App user reg failed: ' + JSON.stringify(regAppData));
  const appUserId = regAppData.data.user.id;
  const appUserToken = regAppData.data.accessToken;
  console.log('  -> End-user registered! ID:', appUserId, 'Email:', appUserEmail);

  // 8. Application User Login
  console.log('[8/12] Logging in end-user...');
  const loginAppRes = await fetch(`${baseUrl}/api/v1/auth/${credential.publicKey}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: appUserEmail, password: 'UserSecretPassword123!' })
  });
  const loginAppData = await loginAppRes.json();
  if (loginAppRes.status !== 200) throw new Error('App user login failed');
  console.log('  -> End-user logged in successfully.');

  // 9. Deny-by-Default Permission Check (Before role assignment)
  console.log('[9/12] Testing deny-by-default permission check...');
  const authCheck1 = await fetch(`${baseUrl}/api/v1/auth/${credential.publicKey}/authorize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${appUserToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission: 'data:read' })
  });
  console.log('  -> Status for unassigned user:', authCheck1.status, '(expected 403 Forbidden)');
  if (authCheck1.status !== 403) throw new Error('Deny-by-default failed! Status was: ' + authCheck1.status);

  // 10. Assign Viewer Role to App User
  console.log('[10/12] Assigning viewer role to end-user...');
  const assignRoleRes = await fetch(`${baseUrl}/api/v1/projects/${project.id}/users/${appUserId}/roles`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: viewerRole.id })
  });
  const assignRoleData = await assignRoleRes.json();
  if (assignRoleRes.status !== 200) throw new Error('Role assign failed: ' + JSON.stringify(assignRoleData));
  console.log('  -> Role successfully assigned.');

  // 11. Permission Checks After Role Assignment
  console.log('[11/12] Testing permissions after role assignment...');
  const authCheck2 = await fetch(`${baseUrl}/api/v1/auth/${credential.publicKey}/authorize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${appUserToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission: 'data:read' })
  });
  console.log('  -> Check "data:read" status:', authCheck2.status, '(expected 200 OK)');
  if (authCheck2.status !== 200) throw new Error('Permitted check failed!');

  const authCheck3 = await fetch(`${baseUrl}/api/v1/auth/${credential.publicKey}/authorize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${appUserToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission: 'data:write' })
  });
  console.log('  -> Check "data:write" status:', authCheck3.status, '(expected 403 Forbidden for viewer)');
  if (authCheck3.status !== 403) throw new Error('Denied check failed!');

  // 12. Audit Logs Retrieval
  console.log('[12/12] Fetching project audit logs...');
  const auditRes = await fetch(`${baseUrl}/api/v1/projects/${project.id}/audit-logs`, {
    headers: { 'Authorization': `Bearer ${ownerAccessToken}` }
  });
  const auditData = await auditRes.json();
  if (auditRes.status !== 200) throw new Error('Audit log fetch failed');
  console.log('  -> Audit logs recorded in Atlas:', auditData.data.logs.length, 'entries.');
  console.log('  -> Event types found:', [...new Set(auditData.data.logs.map(l => l.eventType))].join(', '));

  console.log('=== ALL 12 LIVE END-TO-END INTEGRATION STEPS PASSED WITH 100% SUCCESS ===');
}

runE2E().catch(err => {
  console.error('E2E ERROR:', err);
  process.exit(1);
});
