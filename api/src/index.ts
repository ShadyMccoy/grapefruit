import { app, startApolloServer } from "./app";

const port = process.env.PORT || 3000;

startApolloServer().then(() => {
  console.log("Starting express server...");
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`GraphQL ready at http://localhost:${port}/graphql`);
  });
}).catch(err => {
  console.error("Error starting server:", err);
});

