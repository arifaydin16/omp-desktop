export namespace omp {
	
	export class AgentRunOptions {
	    prompt: string;
	    model: string;
	    smolModel: string;
	    slowModel: string;
	    planModel: string;
	    thinkingLevel: string;
	    approvalMode: string;
	    autoApprove: boolean;
	    goalMode: boolean;
	    loopMode: boolean;
	    planYolo: boolean;
	    prewalk: boolean;
	    advisor: boolean;
	    profile: string;
	    cwd: string;
	    sessionId: string;
	    files: string[];
	
	    static createFrom(source: any = {}) {
	        return new AgentRunOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prompt = source["prompt"];
	        this.model = source["model"];
	        this.smolModel = source["smolModel"];
	        this.slowModel = source["slowModel"];
	        this.planModel = source["planModel"];
	        this.thinkingLevel = source["thinkingLevel"];
	        this.approvalMode = source["approvalMode"];
	        this.autoApprove = source["autoApprove"];
	        this.goalMode = source["goalMode"];
	        this.loopMode = source["loopMode"];
	        this.planYolo = source["planYolo"];
	        this.prewalk = source["prewalk"];
	        this.advisor = source["advisor"];
	        this.profile = source["profile"];
	        this.cwd = source["cwd"];
	        this.sessionId = source["sessionId"];
	        this.files = source["files"];
	    }
	}
	export class AuthCredentialItem {
	    provider: string;
	    type: string;
	    key?: string;
	    email?: string;
	    expires?: number;
	    projectId?: string;
	    authorizedAt?: number;
	
	    static createFrom(source: any = {}) {
	        return new AuthCredentialItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.type = source["type"];
	        this.key = source["key"];
	        this.email = source["email"];
	        this.expires = source["expires"];
	        this.projectId = source["projectId"];
	        this.authorizedAt = source["authorizedAt"];
	    }
	}
	export class ModelEntry {
	    id: string;
	    provider: string;
	    kind: string;
	    selector: string;
	    name: string;
	    contextWindow: number;
	    maxTokens: number;
	    reasoning: boolean;
	    thinking: string[];
	    input: string[];
	    cost: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new ModelEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.provider = source["provider"];
	        this.kind = source["kind"];
	        this.selector = source["selector"];
	        this.name = source["name"];
	        this.contextWindow = source["contextWindow"];
	        this.maxTokens = source["maxTokens"];
	        this.reasoning = source["reasoning"];
	        this.thinking = source["thinking"];
	        this.input = source["input"];
	        this.cost = source["cost"];
	    }
	}
	export class ModelCatalog {
	    models: ModelEntry[];
	
	    static createFrom(source: any = {}) {
	        return new ModelCatalog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.models = this.convertValues(source["models"], ModelEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SessionSummary {
	    id: string;
	    path: string;
	    title: string;
	    project: string;
	    cwd: string;
	    model: string;
	    // Go type: time
	    updatedAt: any;
	    msgCount: number;
	    totalCost: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.title = source["title"];
	        this.project = source["project"];
	        this.cwd = source["cwd"];
	        this.model = source["model"];
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.msgCount = source["msgCount"];
	        this.totalCost = source["totalCost"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionDetail {
	    summary: SessionSummary;
	    messages: any[];
	
	    static createFrom(source: any = {}) {
	        return new SessionDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summary = this.convertValues(source["summary"], SessionSummary);
	        this.messages = source["messages"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SkillItem {
	    name: string;
	    description: string;
	    filePath: string;
	    baseDir: string;
	    isCustom: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SkillItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.filePath = source["filePath"];
	        this.baseDir = source["baseDir"];
	        this.isCustom = source["isCustom"];
	    }
	}
	export class WorkspaceFileItem {
	    name: string;
	    relPath: string;
	    fullPath: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceFileItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.relPath = source["relPath"];
	        this.fullPath = source["fullPath"];
	        this.isDir = source["isDir"];
	    }
	}

}

export namespace update {
	
	export class UpdateStatus {
	    currentVersion: string;
	    latestVersion: string;
	    hasUpdate: boolean;
	    channel: string;
	    message: string;
	    // Go type: time
	    lastChecked: any;
	    checking: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.hasUpdate = source["hasUpdate"];
	        this.channel = source["channel"];
	        this.message = source["message"];
	        this.lastChecked = this.convertValues(source["lastChecked"], null);
	        this.checking = source["checking"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

