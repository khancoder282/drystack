import { createConfiguredReader } from "@drystack/astro/reader";
import config from "../../drystack.config";

export const reader = await createConfiguredReader(config);
