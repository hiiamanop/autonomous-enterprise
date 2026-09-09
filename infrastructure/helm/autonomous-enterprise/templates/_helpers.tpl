{{- define "autonomous-enterprise.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "autonomous-enterprise.fullname" -}}
{{- if .Values.fullnameOverride }}{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}{{- else }}{{- printf "%s-%s" .Release.Name (include "autonomous-enterprise.name" .) | trunc 63 | trimSuffix "-" }}{{- end }}
{{- end }}
{{- define "autonomous-enterprise.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "autonomous-enterprise.labels" -}}
helm.sh/chart: {{ include "autonomous-enterprise.chart" . }}
{{ include "autonomous-enterprise.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: autonomous-enterprise
{{- end }}
{{- define "autonomous-enterprise.selectorLabels" -}}
app.kubernetes.io/name: {{ include "autonomous-enterprise.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
{{- define "autonomous-enterprise.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}{{ default (include "autonomous-enterprise.fullname" .) .Values.serviceAccount.name }}{{- else }}{{ default "default" .Values.serviceAccount.name }}{{- end }}
{{- end }}
