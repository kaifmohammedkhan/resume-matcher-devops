pipeline {
    agent any

    options {
        // Prevent multiple complete pipeline executions from competing
        // for Jenkins resources and workspaces.
        disableConcurrentBuilds()

        // The parallel branches perform their own isolated checkouts.
        skipDefaultCheckout(true)

        // Keep build history under control.
        buildDiscarder(logRotator(
            numToKeepStr: '20',
            artifactNumToKeepStr: '20'
        ))
    }

    triggers {
        // Trigger on push to pre-main branch
        githubPush()
    }

    stages {

        // ============================================================
        // PARALLEL JOBS
        // Each branch gets its own workspace.
        // This prevents .git/index.lock collisions.
        // ============================================================

        stage('Parallel Jobs') {
            parallel {

                // ====================================================
                // CI JOB
                // ====================================================

                stage('CI Job') {
                    agent none

                    stages {

                        stage('Checkout Code') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    deleteDir()
                                    checkout scm
                                }
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    sh "sed -i 's/\\r\$//' scripts/*.sh"
                                }
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    sh "chmod +x scripts/*.sh"
                                }
                            }
                        }

                        stage('Run Tests') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    sh "./scripts/ci-test.sh"
                                }
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    script {
                                        def jdkHome = tool(
                                            name: 'Java-21',
                                            type: 'hudson.model.JDK'
                                        )

                                        env.CI_JAVA_HOME = jdkHome
                                    }

                                    sh '''
                                        export JAVA_HOME="$CI_JAVA_HOME"
                                        export PATH="$JAVA_HOME/bin:$PATH"

                                        echo "Java configuration:"
                                        java -version
                                    '''
                                }
                            }
                        }

                        stage('SonarCloud Analysis') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        withCredentials([
                                            string(
                                                credentialsId: 'SONAR_TOKEN',
                                                variable: 'SONAR_TOKEN'
                                            ),
                                            string(
                                                credentialsId: 'SONAR_HOST',
                                                variable: 'SONAR_HOST'
                                            ),
                                            string(
                                                credentialsId: 'SONAR_ORG',
                                                variable: 'SONAR_ORG'
                                            ),
                                            string(
                                                credentialsId: 'SONAR_PROJECT_KEY',
                                                variable: 'SONAR_PROJECT_KEY'
                                            )
                                        ]) {
                                            sh '''
                                                export JAVA_HOME="$CI_JAVA_HOME"
                                                export PATH="$JAVA_HOME/bin:$PATH"

                                                ./scripts/ci-sonarcloud.sh
                                            '''
                                        }
                                    }
                                }
                            }
                        }

                        stage('Download Trivy HTML Template') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    sh """
                                        curl --proto '=https' --tlsv1.2 -sSLf \
                                        https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl \
                                        -o html.tpl
                                    """
                                }
                            }
                        }

                        stage('Run Trivy FS Scan') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        sh """
                                            trivy fs . \
                                            --format template \
                                            --template '@html.tpl' \
                                            -o trivy-fs-report.html \
                                            --ignore-unfixed \
                                            --vuln-type os,library
                                        """
                                    }
                                }
                            }
                        }

                        stage('Build Local Image for Trivy Scan') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        sh "docker build -t app-local:latest ."
                                    }
                                }
                            }
                        }

                        stage('Run Trivy Image Scan') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        sh """
                                            trivy image app-local:latest \
                                            --format template \
                                            --template '@html.tpl' \
                                            -o trivy-img-report.html \
                                            --ignore-unfixed \
                                            --vuln-type os,library
                                        """
                                    }
                                }
                            }
                        }

                        stage('Install & Run Gitleaks') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        withCredentials([
                                            string(
                                                credentialsId: 'GITHUB_TOKEN',
                                                variable: 'GITHUB_TOKEN'
                                            )
                                        ]) {
                                            sh "gitleaks detect --verbose"
                                        }
                                    }
                                }
                            }
                        }

                        stage('Security Checks') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        sh "./scripts/ci-security-checks.sh"
                                    }
                                }
                            }
                        }

                        stage('Consolidate & Stash CI Reports') {
                            steps {
                                ws("${env.WORKSPACE}@ci") {
                                    sh '''
                                        mkdir -p reports/security

                                        cp reports/security/security-report.html \
                                            ./security-report.html 2>/dev/null || true

                                        cp reports/sonar-summary.html \
                                            ./sonar-summary.html 2>/dev/null || true

                                        [[ -f test-summary.html ]] || \
                                            echo "<html><body><h1>Test Summary Missing</h1></body></html>" \
                                            > test-summary.html

                                        [[ -f sonar-summary.html ]] || \
                                            echo "<html><body><h1>Sonar Summary Missing</h1></body></html>" \
                                            > sonar-summary.html

                                        [[ -f trivy-fs-report.html ]] || \
                                            echo "<html><body><h1>Trivy FS Scan Missing</h1></body></html>" \
                                            > trivy-fs-report.html

                                        [[ -f trivy-img-report.html ]] || \
                                            echo "<html><body><h1>Trivy Image Scan Missing</h1></body></html>" \
                                            > trivy-img-report.html

                                        [[ -f security-report.html ]] || \
                                            echo "<html><body><h1>Security Report Missing</h1></body></html>" \
                                            > security-report.html
                                    '''

                                    archiveArtifacts(
                                        artifacts: '''
                                            test-summary.html,
                                            sonar-summary.html,
                                            trivy-fs-report.html,
                                            trivy-img-report.html,
                                            security-report.html
                                        ''',
                                        allowEmptyArchive: true
                                    )

                                    stash(
                                        name: 'ci-reports-premain',
                                        includes: '''
                                            test-summary.html,
                                            sonar-summary.html,
                                            trivy-fs-report.html,
                                            trivy-img-report.html,
                                            security-report.html
                                        '''
                                    )
                                }
                            }
                        }
                    }
                }


                // ====================================================
                // OWASP JOB
                // ====================================================

                stage('OWASP Job') {
                    agent none

                    stages {

                        stage('Checkout Code') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    deleteDir()
                                    checkout scm
                                }
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    sh "sed -i 's/\\r\$//' scripts/*.sh"
                                }
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    sh "chmod +x scripts/*.sh"
                                }
                            }
                        }

                        stage('Setup Java 21') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    script {
                                        def jdkHome = tool(
                                            name: 'Java-21',
                                            type: 'hudson.model.JDK'
                                        )

                                        env.OWASP_JAVA_HOME = jdkHome
                                    }

                                    sh '''
                                        export JAVA_HOME="$OWASP_JAVA_HOME"
                                        export PATH="$JAVA_HOME/bin:$PATH"

                                        echo "Java configuration:"
                                        java -version
                                    '''
                                }
                            }
                        }

                        stage('OWASP Dependency Check') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    catchError(
                                        buildResult: 'SUCCESS',
                                        stageResult: 'FAILURE'
                                    ) {
                                        withCredentials([
                                            string(
                                                credentialsId: 'NVD_API_KEY',
                                                variable: 'NVD_API_KEY'
                                            )
                                        ]) {
                                            sh '''
                                                export JAVA_HOME="$OWASP_JAVA_HOME"
                                                export PATH="$JAVA_HOME/bin:$PATH"

                                                # Provide explicit heap space to prevent OOM during NVD cache processing
                                                export JAVA_OPTS="-Xms1024m -Xmx4096m"
                                                export JVM_ARGS="-Xmx4g -XX:MaxRAMPercentage=75.0"

                                                # Execute OWASP check with purge flag to clean corrupted H2 cache
                                                ./scripts/ci-owasp.sh --purge
                                            '''
                                        }
                                    }
                                }
                            }
                        }

                        stage('Consolidate & Stash OWASP Report') {
                            steps {
                                ws("${env.WORKSPACE}@owasp") {
                                    sh '''
                                        cp reports/dependency-check-report.html \
                                            ./dependency-check-report.html 2>/dev/null || true

                                        [[ -f dependency-check-report.html ]] || \
                                            echo "<html><body><h1>OWASP Dependency Check Missing</h1></body></html>" \
                                            > dependency-check-report.html
                                    '''

                                    archiveArtifacts(
                                        artifacts: 'dependency-check-report.html',
                                        allowEmptyArchive: true
                                    )

                                    stash(
                                        name: 'owasp-report-premain',
                                        includes: 'dependency-check-report.html'
                                    )
                                }
                            }
                        }
                    }
                }


                // ====================================================
                // QA JOB
                // ====================================================

                stage('QA Job') {
                    agent none

                    stages {

                        stage('Checkout Code') {
                            steps {
                                ws("${env.WORKSPACE}@qa") {
                                    deleteDir()
                                    checkout scm
                                }
                            }
                        }

                        stage('Normalize Line Endings') {
                            steps {
                                ws("${env.WORKSPACE}@qa") {
                                    sh "sed -i 's/\\r\$//' scripts/*.sh"
                                }
                            }
                        }

                        stage('Ensure Scripts Executable') {
                            steps {
                                ws("${env.WORKSPACE}@qa") {
                                    sh "chmod +x scripts/*.sh"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
