import "dotenv/config";

import { App } from "./app.js";


async function bootstrap() {

    const port =
        Number(process.env.PORT) || 3000;

    const app = new App();

    await app.listen(port);
}


bootstrap();