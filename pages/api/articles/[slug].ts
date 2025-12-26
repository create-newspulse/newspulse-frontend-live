import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	res.status(501).json({
		error: "Not implemented",
		message: "This endpoint is a placeholder. Connect it to your articles backend.",
		slug: req.query.slug ?? null,
	});
}

