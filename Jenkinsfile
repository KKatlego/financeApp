pipeline {
    agent any

    environment {
        // cPanel Configuration - Update these values
        CPANEL_HOST = '31.22.4.46'  // Temporary FTP hostname (may work better)
        CPANEL_DEPLOY_PATH = '/lecture.mvelow.co.za'

        // Deployment Settings
        DEPLOYMENT_NAME = 'simple-app'
    }

    stages {
        stage('Code Checkout') {
            steps {
                echo 'Checking out code from repository...'
                checkout scm
                bat 'dir /b'
                echo "Checkout completed successfully!"
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing backend dependencies...'
                bat 'cd backend && npm install --production'
                echo 'Dependencies installed successfully!'
            }
        }

        stage('Build') {
            steps {
                echo 'Building application...'
                echo 'Build completed successfully!'
            }
        }

        stage('Test') {
            steps {
                echo 'Running tests...'
                bat '''
                    if not exist "frontend\\index.html" exit 1
                    if not exist "frontend\\style.css" exit 1
                    if not exist "frontend\\script.js" exit 1
                    echo Frontend files verified!
                '''
                echo "All tests passed!"
            }
        }

        stage('Deploy to FTP') {
            steps {
                echo 'Deploying to FTP...'

                script {
                    // Create deployment package
                    bat """
                        echo Creating deployment package...
                        if exist deploy-package rmdir /s /q deploy-package
                        mkdir deploy-package
                        xcopy /e /i frontend deploy-package\\frontend
                        mkdir deploy-package\\backend
                        copy backend\\package.json deploy-package\\backend\\
                        copy backend\\server.js deploy-package\\backend\\
                        copy backend\\.htaccess deploy-package\\backend\\
                        echo Package created successfully!
                    """

                    // Deploy using PowerShell with credentials
                    withCredentials([usernamePassword(
                        credentialsId: 'cpanel-password',
                        usernameVariable: 'FTP_USER',
                        passwordVariable: 'FTP_PASS'
                    )]) {
                        powershell '''
                            $ftpHost = $env:CPANEL_HOST
                            $ftpUser = $env:FTP_USER
                            $ftpPass = $env:FTP_PASS
                            $ftpDir  = $env:CPANEL_DEPLOY_PATH

                            Write-Host "Deploying to: $ftpHost$ftpDir"

                            # Test FTP connection first
                            try {
                                Write-Host "Testing FTP connection..."
                                $testRequest = [System.Net.FtpWebRequest]::Create("ftp://$ftpHost/")
                                $testRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                $testRequest.Method = [System.Net.WebRequestMethods+Ftp]::PrintWorkingDirectory
                                $testResponse = $testRequest.GetResponse()
                                $testResponse.Close()
                                Write-Host "FTP connection successful!"
                            } catch {
                                Write-Host "ERROR: FTP connection failed!"
                                Write-Host $_.Exception.Message
                                exit 1
                            }

                            # Helper function to create FTP directory
                            function Create-FtpDirectory {
                                param($dirPath)
                                try {
                                    $uri = "ftp://$ftpHost$dirPath"
                                    $request = [System.Net.FtpWebRequest]::Create($uri)
                                    $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
                                    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                    $request.GetResponse().Close()
                                    Write-Host "Created directory: $dirPath"
                                } catch {
                                    Write-Host "Directory may already exist: $dirPath"
                                }
                            }

                            # Create directories first
                            Create-FtpDirectory "$ftpDir/frontend"
                            Create-FtpDirectory "$ftpDir/backend"

                            # Upload frontend files
                            $localPath = "deploy-package\\frontend"
                            if (Test-Path $localPath) {
                                $files = Get-ChildItem $localPath -File
                                foreach ($file in $files) {
                                    $uri = "ftp://$ftpHost$ftpDir/frontend/" + $file.Name
                                    Write-Host "Uploading frontend:" $file.Name
                                    $request = [System.Net.FtpWebRequest]::Create($uri)
                                    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                                    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                    $request.UseBinary = $true
                                    $content = [System.IO.File]::ReadAllBytes($file.FullName)
                                    $request.ContentLength = $content.Length
                                    $stream = $request.GetRequestStream()
                                    $stream.Write($content, 0, $content.Length)
                                    $stream.Close()
                                }
                            }

                            # Upload backend files
                            $localPath = "deploy-package\\backend"
                            if (Test-Path $localPath) {
                                $files = Get-ChildItem $localPath -File
                                foreach ($file in $files) {
                                    $uri = "ftp://$ftpHost$ftpDir/backend/" + $file.Name
                                    Write-Host "Uploading backend:" $file.Name
                                    $request = [System.Net.FtpWebRequest]::Create($uri)
                                    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                                    $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
                                    $request.UseBinary = $true
                                    $content = [System.IO.File]::ReadAllBytes($file.FullName)
                                    $request.ContentLength = $content.Length
                                    $stream = $request.GetRequestStream()
                                    $stream.Write($content, 0, $content.Length)
                                    $stream.Close()
                                }
                            }

                            Write-Host "Deployment completed successfully!"
                        '''
                    }
                }
            }
        }

        stage('Post-Deploy') {
            steps {
                echo 'Restarting Node.js application...'

                script {
                    try {
                        withCredentials([usernamePassword(
                            credentialsId: 'cpanel-password',
                            usernameVariable: 'SSH_USER',
                            passwordVariable: 'SSH_PASS'
                        )]) {
                            powershell '''
                                $sshHost = $env:CPANEL_HOST
                                $sshUser = $env:SSH_USER
                                $sshPass = $env:SSH_PASS
                                $appPath = $env:CPANEL_DEPLOY_PATH + "/backend"

                                # Find plink for SSH
                                $plinkPaths = @(
                                    "C:\\Program Files\\PuTTY\\plink.exe",
                                    "C:\\Program Files (x86)\\PuTTY\\plink.exe",
                                    "plink.exe"
                                )

                                $plinkPath = $null
                                foreach ($path in $plinkPaths) {
                                    if (Test-Path $path) {
                                        $plinkPath = $path
                                        break
                                    }
                                }

                                if ($plinkPath) {
                                    Write-Host "Restarting Node.js application via SSH..."

                                    $commands = @"
                                        cd $appPath
                                        pkill -f "node server.js" || echo "No existing process"
                                        nohup node server.js > app.log 2>&1 &
                                        echo "Application restarted!"
"@

                                    $output = & $plinkPath -ssh -pw $sshPass "$sshUser@$sshHost" $commands 2>&1
                                    Write-Host $output
                                    Write-Host "Node.js application restarted successfully!"
                                } else {
                                    Write-Host "SSH tool not found - manual restart required"
                                }
                            '''
                        }

                    } catch (Exception e) {
                        echo "SSH restart failed: ${e.message}"
                        echo "Please restart manually via cPanel"
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed! Check the logs for details.'
        }

        always {
            script {
                echo "Cleaning up workspace..."
                bat """
                    if exist deploy-package rmdir /s /q deploy-package
                    echo Cleanup completed!
                """

                echo """
                    ========================================
                    Build Summary
                    ========================================
                    Status: ${currentBuild.result ?: 'SUCCESS'}
                    Duration: ${currentBuild.durationString}
                    Build Number: ${env.BUILD_NUMBER}
                    ========================================
                """
            }
        }
    }
}
