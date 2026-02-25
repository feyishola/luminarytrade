it('/agents (GET) should return 403 for USER role', async () => {
  return request(app.getHttpServer())
    .get('/agents')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(403);
});