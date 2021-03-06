export const createApp = async (axios, pipeline, stage, name) => {

	// create the new app
	const app = {
		name,
		region: 'us',
		stack: 'container'
	}
	console.log(`creating ${app.name}`)
	const appResponse = await axios.post(`apps`, app)
	const { id: appId } = appResponse.data

	// add the app to the pipeline
	const coupling = {
		app: appId,
		pipeline,
		stage
	}
	console.log(`adding to pipeline`)
	await axios.post(`pipeline-couplings`, coupling)

	// provision a postgresql db
	const db = {
		plan: 'heroku-postgresql',
		attachment: {
			name: 'DATABASE'
		}
	}
	console.log(`provisioing db`)
	await axios.post(`apps/${appId}/addons`, db)

	// get the database url from the config
	const configResponse = await axios.get(`apps/${appId}/config-vars`)
	const { DATABASE_URL } = configResponse.data

	return { app_name: app.name, DATABASE_URL }
}

export const deleteApp = async (axios, name) => {

	// delete the app
	console.log(`deleting ${name}`)
	await axios.delete(`/apps/${name}`)

	return { app_name: name }
}