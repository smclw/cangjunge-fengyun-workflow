export type WorkflowState='not_started'|'in_progress'|'waiting_manual'|'completed'|'risk';
export interface ProjectSummary {id:string;name:string;projectType:string;platforms:string[];stage:string;status:string;videos:number;published:number;followers:number;revenueMinor:number;updatedAt:string;dataClass:'demo'|'real';demoNotice:string;}
export interface MetricValues {impressions:number|null;views:number|null;threeSecondViews:number|null;averageWatchSeconds:number|null;totalWatchSeconds:number|null;completions:number|null;likes:number|null;comments:number|null;shares:number|null;saves:number|null;followersGained:number|null;profileVisits:number|null;linkClicks:number|null;productClicks:number|null;addToCarts:number|null;orders:number|null;gmvMinor:number|null;commissionMinor:number|null;refundsMinor:number|null;productionCostMinor:number|null;adCostMinor:number|null;actualRevenueMinor:number|null;}
export interface Project {
  schemaVersion:1;revision:number;id:string;name:string;projectType:string;dataClass:'demo'|'real';demoNotice:string;status:string;stage:string;currentWizardStep:number;createdAt:string;updatedAt:string;currency:string;
  goals:{platforms:string[];region:string;language:string;currentFollowers:number;weeklyPosts:number;budgetMinor:number|null;onCamera:boolean;hasPhysicalProduct:boolean;hasProductLink:boolean;monetizationMethods:string[];growthWeight:number;monetizationWeight:number};
  positioning:{accountName:string;statement:string;audience:string;corePain:string;promise:string;style:string;avatar:string;series:string[];languages:string[];prohibitedContent:string[]};
  sources:Array<Record<string,unknown>>;materials:Array<Record<string,unknown>>;products:Array<Record<string,unknown>>;
  topics:Array<{id:string;name:string;contentType:string;productId:string;platform:string;growthScore:number;monetizationScore:number;riskPenalty:number;compositeScore:number;angle:string;status:string;publishBlocked:boolean;risks:string[]}>;
  scripts:Array<Record<string,unknown>>;topviewPackages:Array<Record<string,unknown>>;publications:Array<Record<string,unknown>>;metrics:Array<Record<string,unknown>&{values:MetricValues}>;reviews:Array<Record<string,unknown>>;experiments:Array<Record<string,unknown>>;
  workflow:Array<{id:string;label:string;state:WorkflowState}>;manualTasks:Array<{id:string;label:string;category:string;completed:boolean;updatedAt:string}>;qualityChecks:Array<{id:string;label:string;status:string;note:string}>;risks:string[];unverified:string[];summary:string;
}
export interface Dashboard {
  project:{id:string;name:string;dataClass:'demo'|'real';demoNotice:string;updatedAt:string;currency:string};periodDays:number;periodFrom:string;periodTo:string;
  kpis:Record<string,number|null>;trend:Array<Record<string,number|string>>;funnel:Array<{label:string;value:number|null;conversion:number|null}>;warnings:string[];
  topics:Project['topics'];manualTasks:Project['manualTasks'];aiTasks:Array<{label:string;done:boolean}>;workflow:Project['workflow'];bestVideo:null|Record<string,unknown>;videoPerformance:Array<Record<string,unknown>>;review:Record<string,unknown>|null;
}
