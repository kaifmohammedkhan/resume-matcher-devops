pipeline {
    agent any

    triggers {
        // Trigger on push to pre-main branch
        githubPush() 
    }

    stages {
        stage('Parallel Jobs') {
            parallel {
                stage('CI Job') {
                    stages {
                        stage('Checkout Code') {
                            steps {
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh "sed -i 's/\\r\$//' scripts/*.sh"
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh "chmod +x scripts/*.sh"
                            }
                        }

                        stage('Run Tests') {
                            steps {
                                sh "./scripts/ci-test.sh"
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                // Assumes Java 21 is configured under Jenkins Tools as 'Java-21'
                                envTool name: 'Java-21', type: 'jdk'
                            }
                        }

                        stage('SonarCloud Analysis') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    withCredentials([
                                        string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN'),
                                        string(credentialsId: 'SONAR_HOST', variable: 'SONAR_HOST'),
                                        string(credentialsId: 'SONAR_ORG', variable: 'SONAR_ORG'),
                                        string(credentialsId: 'SONAR_PROJECT_KEY', variable: 'SONAR_PROJECT_KEY')
                                    ]) {
                                        sh "./scripts/ci-sonarcloud.sh"
                                    }
                                }
                            }
                        }

                        stage('Download Trivy HTML Template') {
                            steps {
                                sh "curl --proto '=https' --tlsv1.2 -sSLf https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl -o html.tpl"
                            }
                        }

                        stage('Run Trivy FS Scan') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    sh "trivy fs . --format template --template '@html.tpl' -o trivy-fs-report.html --ignore-unfixed --vuln-type os,library"
                                }
                            }
                        }

                        stage('Build Local Image for Trivy Scan') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    sh "docker build -t app-local:latest ."
                                }
                            }
                        }

                        stage('Run Trivy Image Scan') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    sh "trivy image app-local:latest --format template --template '@html.tpl' -o trivy-img-report.html --ignore-unfixed --vuln-type os,library"
                                }
                            }
                        }

                        stage('Install & Run Gitleaks') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    withCredentials([string(credentialsId: 'GITHUB_TOKEN', variable: 'GITHUB_TOKEN')]) {
                                        sh "gitleaks detect --verbose"
                                    }
                                }
                            }
                        }

                        stage('Security Checks') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    sh "./scripts/ci-security-checks.sh"
                                }
                            }
                        }

                        stage('Consolidate & Stash CI Reports') {
                            steps {
                                sh '''
                                    mkdir -p reports/security
                                    cp reports/security/security-report.html ./security-report.html 2>/dev/null || true
                                    cp reports/sonar-summary.html ./sonar-summary.html 2>/dev/null || true
                                    
                                    [[ -f test-summary.html ]] || echo "<html><body><h1>Test Summary Missing</h1></body></html>" > test-summary.html
                                    [[ -f sonar-summary.html ]] || echo "<html><body><h1>Sonar Summary Missing</h1></body></html>" > sonar-summary.html
                                    [[ -f trivy-fs-report.html ]] || echo "<html><body><h1>Trivy FS Scan Missing</h1></body></html>" > trivy-fs-report.html
                                    [[ -f trivy-img-report.html ]] || echo "<html><body><h1>Trivy Image Scan Missing</h1></body></html>" > trivy-img-report.html
                                    [[ -f security-report.html ]] || echo "<html><body><h1>Security Report Missing</h1></body></html>" > security-report.html
                                '''
                                archiveArtifacts artifacts: 'test-summary.html, sonar-summary.html, trivy-fs-report.html, trivy-img-report.html, security-report.html', allowEmptyArchive: true
                                stash name: 'ci-reports', includes: 'test-summary.html, sonar-summary.html, trivy-fs-report.html, trivy-img-report.html, security-report.html'
                            }
                        }
                    }
                }

                stage('OWASP Job') {
                    stages {
                        stage('Checkout Code') {
                            steps {
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh "sed -i 's/\\r\$//' scripts/*.sh"
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh "chmod +x scripts/*.sh"
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                envTool name: 'Java-21', type: 'jdk'
                            }
                        }

                        stage('OWASP Dependency Check') {
                            steps {
                                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                                    withCredentials([string(credentialsId: 'NVD_API_KEY', variable: 'NVD_API_KEY')]) {
                                        sh "./scripts/ci-owasp.sh"
                                    }
                                }
                            }
                        }

                        stage('Consolidate & Stash OWASP Report') {
                            steps {
                                sh '''
                                    cp reports/dependency-check-report.html ./dependency-check-report.html 2>/dev/null || true
                                    [[ -f dependency-check-report.html ]] || echo "<html><body><h1>OWASP Dependency Check Missing</h1></body></html>" > dependency-check-report.html
                                '''
                                archiveArtifacts artifacts: 'dependency-check-report.html', allowEmptyArchive: true
                                stash name: 'owasp-report', includes: 'dependency-check-report.html'
                            }
                        }
                    }
                }

                stage('QA Job') {
                    stages {
                        stage('Checkout Code') {
                            steps {
                                checkout scm
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                sh "sed -i 's/\\r\$//' scripts/*.sh"
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                sh "chmod +x scripts/*.sh"
                            }
                        }

                        stage('Cypress Tests') {
                            steps {
                                sh "./scripts/qa-cypress.sh"
                            }
                        }

                        stage('K6 Load & Smoke Tests') {
                            steps {
                                sh "./scripts/qa-k6-load.sh"
                                sh "./scripts/qa-k6-smoke.sh"
                            }
                        }

                        stage('Install Nodemailer & Run QA Report') {
                            steps {
                                sh "npm install nodemailer"
                                withCredentials([
                                    string(credentialsId: 'EMAIL_USER', variable: 'EMAIL_USER'),
                                    string(credentialsId: 'EMAIL_PASS', variable: 'EMAIL_PASS'),
                                    string(credentialsId: 'QA_EMAIL_TO', variable: 'QA_EMAIL_TO'),
                                    string(credentialsId: 'QA_EMAIL_CC', variable: 'QA_EMAIL_CC')
                                ]) {
                                    withEnv([
                                        "NODE_PATH=${WORKSPACE}/node_modules",
                                        "GITHUB_REF_NAME=${env.BRANCH_NAME}",
                                        "GITHUB_RUN_NUMBER=${env.BUILD_NUMBER}",
                                        "GITHUB_REPOSITORY=${env.JOB_NAME}"
                                    ]) {
                                        sh "./scripts/qa-report.sh"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Send Email Job') {
            steps {
                checkout scm
                
                sh "sed -i 's/\\r\$//' scripts/*.sh"
                sh "chmod +x scripts/*.sh"

                unstash 'ci-reports'
                unstash 'owasp-report'

                sh "ls -la"

                withCredentials([
                    string(credentialsId: 'EMAIL_USER', variable: 'EMAIL_USER'),
                    string(credentialsId: 'EMAIL_PASS', variable: 'EMAIL_PASS'),
                    string(credentialsId: 'QA_EMAIL_TO', variable: 'QA_EMAIL_TO'),
                    string(credentialsId: 'QA_EMAIL_CC', variable: 'QA_EMAIL_CC')
                ]) {
                    sh "./scripts/ci-email.sh"
                }
            }
        }
    }
}
